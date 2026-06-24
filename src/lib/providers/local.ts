// 本地推理 Provider：Transformers.js 3 + ONNX Runtime Web（WebGPU/WASM）
//
// 说明：@huggingface/transformers 的 npm 包会拉入 onnxruntime-node 原生二进制，
// 无法在浏览器构建中打包。因此这里通过 CDN 动态加载 ESM 版本（官方推荐用法），
// 库代码本身可由 Service Worker 缓存以支持离线；模型权重缓存于 IndexedDB。
//
// 中国加速：支持切换到 hf-mirror.com 镜像源下载模型权重。

import type { TokenUsage } from "../types";
import { estimateTokens } from "../crypto";
import { getModelById, pickDevice } from "../models";
import { downloadModelFiles, createCustomCache } from "../modelDownloader";
import {
  type ChatParams,
  type ChatProvider,
  type ChatResult,
  type ProgressInfo,
  AbortError,
} from "./types";

// Transformers.js 库的 CDN 源（按优先级降级，任一可用即可）
// jsdelivr 在中国通常可用但偶发不稳定；esm.sh 与 unpkg 作为降级。
const TRANSFORMERS_CDNS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1",
  "https://esm.sh/@huggingface/transformers@3.8.1",
  "https://unpkg.com/@huggingface/transformers@3.8.1",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TfModule = any;

let tfPromise: Promise<TfModule> | null = null;

/** 引擎（Transformers.js 库）加载失败 —— 通常是 CDN 网络问题 */
export class EngineLoadError extends Error {
  constructor(public readonly triedHosts: string[]) {
    super(
      "推理引擎加载失败：所有 CDN 均无法访问。请检查网络后重试，或切换 Wi-Fi / 移动数据。",
    );
    this.name = "EngineLoadError";
  }
}

function loadTransformers(): Promise<TfModule> {
  if (tfPromise) return tfPromise;

  tfPromise = (async () => {
    const tried: string[] = [];
    for (const cdn of TRANSFORMERS_CDNS) {
      tried.push(cdn);
      try {
        const mod = await import(/* @vite-ignore */ cdn);
        // 模型文件由自定义下载器缓存到 IndexedDB，通过 patch fetch 加载，
        // 不使用 Transformers.js 自带的浏览器缓存（避免与 IndexedDB 重复）
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = false;
        return mod;
      } catch (e) {
        console.warn(`[transformers] CDN 加载失败: ${cdn}`, e);
      }
    }
    // 全部失败：清空缓存以便下次重试
    tfPromise = null;
    throw new EngineLoadError(tried);
  })();

  return tfPromise;
}

interface LoadedModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any;
  modelId: string;
  device: string;
}

export class LocalProvider implements ChatProvider {
  id = "local" as const;
  private modelId: string;
  private loaded: LoadedModel | null = null;
  private aborted = false;
  private loadingPromise: Promise<LoadedModel> | null = null;
  private device: string = "wasm";
  private mirror: "auto" | "hf" | "hf-mirror" = "auto";
  private abortController: AbortController | null = null;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  setModel(modelId: string) {
    if (modelId !== this.modelId) {
      this.modelId = modelId;
      this.loaded = null;
      this.loadingPromise = null;
    }
  }

  setMirror(mirror: "auto" | "hf" | "hf-mirror") {
    if (mirror !== this.mirror) {
      this.mirror = mirror;
      // 已加载的模型需要重新加载以应用新镜像（仅未缓存时）
    }
  }

  async isReady(): Promise<boolean> {
    return !!this.loaded;
  }

  getDevice(): string {
    return this.device;
  }

  abort(): void {
    this.aborted = true;
    this.abortController?.abort();
  }

  /** 加载（含首次下载）模型，带详细进度回调 */
  async ensureLoaded(
    onProgress?: (info: ProgressInfo) => void,
  ): Promise<LoadedModel> {
    if (this.loaded) return this.loaded;
    if (this.loadingPromise) return this.loadingPromise;

    this.aborted = false;
    this.abortController = new AbortController();
    this.loadingPromise = this.doLoad(onProgress);
    try {
      this.loaded = await this.loadingPromise;
      return this.loaded;
    } catch (e) {
      this.loadingPromise = null;
      throw e;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async doLoad(
    onProgress?: (info: ProgressInfo) => void,
  ): Promise<LoadedModel> {
    onProgress?.({ stage: "init", progress: 0, message: "加载推理引擎…" });
    const tf = await loadTransformers();

    const config = getModelById(this.modelId);

    // 选择后端：iOS 强制 WASM，其他优先 WebGPU 降级 WASM
    onProgress?.({ stage: "init", progress: 5, message: "检测推理后端…" });
    const { device, reason } = await pickDevice();
    this.device = device;
    onProgress?.({ stage: "init", progress: 8, message: reason });

    // 根据后端选择 dtype：WASM 用 q8（兼容性最佳），WebGPU 用 q4（体积小）
    let dtype = config.dtype;
    if (this.device === "wasm" && config.dtype === "q4") {
      dtype = "q8";
      onProgress?.({
        stage: "init",
        progress: 10,
        message: "WASM 后端使用 Q8 精度（兼容性最佳）",
      });
    }

    // ---- 阶段1：用自定义下载器预取文件到 IndexedDB（断点续传）----
    onProgress?.({
      stage: "downloading",
      progress: 0,
      message: `准备下载 ${config.name}（${config.sizeLabel}）`,
      filesCompleted: 0,
      filesTotal: 0,
      loadedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
    });

    let cachedFiles: Map<string, Blob>;
    try {
      cachedFiles = await downloadModelFiles(
        config.repo,
        dtype,
        this.mirror,
        (info) => {
          const shortName = info.file.split("/").pop() || info.file;
          onProgress?.({
            stage: "downloading",
            progress: info.progress,
            message: `下载 ${shortName}（${info.filesCompleted}/${info.filesTotal}）`,
            currentFile: shortName,
            fileProgress: info.fileProgress,
            filesCompleted: info.filesCompleted,
            filesTotal: info.filesTotal,
            loadedBytes: info.loadedBytes,
            totalBytes: info.totalBytes,
            speedBps: info.speedBps,
            etaSeconds: info.etaSeconds,
          });
        },
        this.abortController?.signal,
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw new AbortError();
      const msg = (e as Error)?.message ?? String(e);
      throw new Error(
        `模型下载失败：${msg}。已下载部分已缓存，重试可断点续传。`,
      );
    }

    // ---- 阶段2：配置 customCache，让 Transformers.js 从 IndexedDB 加载 ----
    // 用官方支持的 env.useCustomCache + env.customCache，比 patch fetch 可靠：
    // Transformers.js 内部（含 ONNX Runtime Web Worker）都会走 customCache.match
    onProgress?.({
      stage: "loading",
      progress: 95,
      message: "从本地缓存加载模型…",
    });

    tf.env.useCustomCache = true;
    tf.env.customCache = createCustomCache(cachedFiles);
    // 禁用浏览器自带 Cache API，避免与 customCache 冲突
    tf.env.useBrowserCache = false;

    let generator: TfModule;
    try {
      // 加载超时检测：60 秒未完成则报错，避免卡死无反馈
      const loadPromise = tf.pipeline("text-generation", config.repo, {
        dtype,
        device: this.device,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "模型加载超时（60秒）。可能是缓存未命中导致尝试联网，请检查网络后重试。",
            ),
          );
        }, 60000);
      });
      generator = await Promise.race([loadPromise, timeoutPromise]);
    } catch (e) {
      if (e instanceof EngineLoadError) throw e;
      const msg = (e as Error)?.message ?? String(e);
      throw new Error(`模型加载失败：${msg}`);
    }

    onProgress?.({ stage: "ready", progress: 100, message: "模型就绪" });

    return { generator, modelId: this.modelId, device: this.device };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    this.aborted = false;
    const loaded = await this.ensureLoaded(params.onProgress);
    const tf = await loadTransformers();

    // 通知进入"思考中"阶段：首次推理需预热（WebGPU shader 编译 / WASM 优化），
    // 可能数秒到数十秒才有第一个 token，需让用户知道在工作。
    params.onProgress?.({
      stage: "loading",
      progress: 99,
      message: "正在思考…",
    });

    let content = "";
    let firstTokenTime = 0;
    let lastTokenTime = 0;
    let warmedUp = false;

    const streamer = new tf.TextStreamer(loaded.generator.tokenizer, {
      skip_prompt: true,
      callback_function: (text: string) => {
        if (this.aborted) throw new AbortError();
        if (!firstTokenTime) {
          firstTokenTime = performance.now();
          warmedUp = true;
          // 第一个 token 到达，切换为"生成中"
          params.onProgress?.({
            stage: "loading",
            progress: 99,
            message: "生成中…",
          });
        }
        lastTokenTime = performance.now();
        content += text;
        params.onToken?.(text);
      },
    });

    // 预热期间定期更新提示，避免用户以为卡住
    const warmupTimer = setInterval(() => {
      if (warmedUp || this.aborted) {
        clearInterval(warmupTimer);
        return;
      }
      params.onProgress?.({
        stage: "loading",
        progress: 99,
        message: "正在思考…（模型预热中，请稍候）",
      });
    }, 4000);

    try {
      await loaded.generator(params.messages, {
        max_new_tokens: params.maxTokens,
        do_sample: params.temperature > 0,
        temperature: Math.max(0.01, params.temperature),
        top_p: params.topP,
        streamer,
      });
    } catch (e) {
      if (e instanceof AbortError || (e as Error)?.name === "AbortError") {
        // 中止：保留已生成内容
      } else {
        throw e;
      }
    } finally {
      clearInterval(warmupTimer);
    }

    const promptTokens = estimateTokens(
      params.messages.map((m) => m.content).join(""),
    );
    const completionTokens = estimateTokens(content);
    const usage: TokenUsage = {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    };

    const elapsedSec =
      firstTokenTime && lastTokenTime
        ? (lastTokenTime - firstTokenTime) / 1000
        : 0;
    const tokPerSec = elapsedSec > 0 ? completionTokens / elapsedSec : 0;

    params.onUsage?.(usage);
    if (tokPerSec > 0) {
      params.onProgress?.({
        stage: "ready",
        progress: 100,
        message: `${tokPerSec.toFixed(1)} tok/s`,
      });
    }

    return { content, usage };
  }

  dispose(): void {
    if (this.loaded) {
      try {
        this.loaded.generator?.dispose?.();
      } catch {
        /* ignore */
      }
      this.loaded = null;
      this.loadingPromise = null;
    }
  }
}
