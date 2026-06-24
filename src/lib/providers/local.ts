// 本地推理 Provider：Transformers.js 3 + ONNX Runtime Web（WebGPU/WASM）
//
// 采用 Transformers.js 官方推荐用法：
// - env.remoteHost 指向 hf-mirror.com（中国加速）
// - env.useBrowserCache = true，浏览器 Cache API 自动缓存，离线可用
// - progress_callback 提供文件级下载进度
// - 不再用自定义下载器/customCache/patch fetch（均不可靠）
//
// 说明：@huggingface/transformers 的 npm 包会拉入 onnxruntime-node 原生二进制，
// 无法在浏览器构建中打包。因此通过 CDN 动态加载 ESM 版本。

import type { TokenUsage } from "../types";
import { estimateTokens } from "../crypto";
import { getModelById, pickDevice } from "../models";
import {
  type ChatParams,
  type ChatProvider,
  type ChatResult,
  type ProgressInfo,
  AbortError,
} from "./types";

// Transformers.js 库的 CDN 源（按优先级降级，任一可用即可）
const TRANSFORMERS_CDNS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1",
  "https://esm.sh/@huggingface/transformers@3.8.1",
  "https://unpkg.com/@huggingface/transformers@3.8.1",
];

// 模型权重镜像源
const MIRROR_HOSTS = {
  hf: "https://huggingface.co",
  "hf-mirror": "https://hf-mirror.com",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TfModule = any;

let tfPromise: Promise<TfModule> | null = null;
let currentRemoteHost: string = MIRROR_HOSTS["hf-mirror"];

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
        // 官方推荐配置：
        // - allowLocalModels=false：浏览器无文件系统，跳过本地查找
        // - useBrowserCache=true：用 Cache API 自动缓存，离线可用
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
        mod.env.remoteHost = currentRemoteHost;
        return mod;
      } catch (e) {
        console.warn(`[transformers] CDN 加载失败: ${cdn}`, e);
      }
    }
    tfPromise = null;
    throw new EngineLoadError(tried);
  })();

  return tfPromise;
}

/** 运行时切换镜像源（需在加载模型前调用） */
function applyMirror(tf: TfModule, mirror: "auto" | "hf" | "hf-mirror") {
  const host =
    mirror === "hf"
      ? MIRROR_HOSTS.hf
      : MIRROR_HOSTS["hf-mirror"]; // auto 也默认用 hf-mirror
  currentRemoteHost = host;
  tf.env.remoteHost = host;
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
    this.mirror = mirror;
  }

  async isReady(): Promise<boolean> {
    return !!this.loaded;
  }

  getDevice(): string {
    return this.device;
  }

  abort(): void {
    this.aborted = true;
  }

  /** 加载（含首次下载）模型，带详细进度回调 */
  async ensureLoaded(
    onProgress?: (info: ProgressInfo) => void,
  ): Promise<LoadedModel> {
    if (this.loaded) return this.loaded;
    if (this.loadingPromise) return this.loadingPromise;

    this.aborted = false;
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
    // 应用镜像源
    applyMirror(tf, this.mirror);

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

    onProgress?.({
      stage: "downloading",
      progress: 0,
      message: `开始下载 ${config.name}（${config.sizeLabel}）`,
      filesCompleted: 0,
      filesTotal: 0,
      loadedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
    });

    // 文件级进度跟踪（Transformers.js progress_callback 数据格式）
    const fileMap = new Map<
      string,
      { progress: number; loaded: number; total: number }
    >();
    let lastSpeedTime = 0;
    let lastSpeedLoaded = 0;
    let speedBps = 0;

    const progressCallback = (info: {
      status?: string;
      file?: string;
      name?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => {
      const file = info.file || info.name;
      const now = Date.now();

      if (file && !fileMap.has(file)) {
        fileMap.set(file, { progress: 0, loaded: 0, total: 0 });
      }

      if (file && typeof info.progress === "number") {
        const fp = fileMap.get(file)!;
        fp.progress = info.progress;
        fp.loaded = info.loaded ?? fp.loaded;
        fp.total = info.total ?? fp.total;

        const totalLoaded = Array.from(fileMap.values()).reduce(
          (s, f) => s + f.loaded,
          0,
        );
        const totalBytes = Array.from(fileMap.values()).reduce(
          (s, f) => s + f.total,
          0,
        );

        // 速度采样（每 500ms）
        if (now - lastSpeedTime > 500) {
          if (lastSpeedTime > 0 && totalLoaded > lastSpeedLoaded) {
            speedBps =
              ((totalLoaded - lastSpeedLoaded) / (now - lastSpeedTime)) * 1000;
          }
          lastSpeedTime = now;
          lastSpeedLoaded = totalLoaded;
        }

        const filesCompleted = Array.from(fileMap.values()).filter(
          (f) => f.progress >= 100,
        ).length;
        const filesTotal = fileMap.size;

        const overallProgress =
          totalBytes > 0
            ? Math.min(99, (totalLoaded / totalBytes) * 100)
            : filesTotal > 0
              ? Math.min(99, (filesCompleted / filesTotal) * 100)
              : 0;

        const etaSeconds =
          speedBps > 0 && totalBytes > 0
            ? Math.max(0, (totalBytes - totalLoaded) / speedBps)
            : 0;

        const shortName = file.split("/").pop() || file;

        onProgress?.({
          stage: "downloading",
          progress: Math.round(overallProgress),
          message: `下载 ${shortName}（${filesCompleted}/${filesTotal}）`,
          currentFile: shortName,
          fileProgress: Math.round(info.progress),
          filesCompleted,
          filesTotal,
          loadedBytes: totalLoaded,
          totalBytes: totalBytes > 0 ? totalBytes : undefined,
          speedBps: speedBps > 0 ? speedBps : undefined,
          etaSeconds,
        });
      }

      if (info.status === "ready" || info.status === "done") {
        if (file) {
          const fp = fileMap.get(file);
          if (fp) fp.progress = 100;
        }
      }
    };

    onProgress?.({
      stage: "loading",
      progress: 99,
      message: "下载完成，正在加载模型到内存…",
    });

    // 加载阶段心跳：pipeline 下载完后进入 ONNX Runtime 初始化（无进度回调），
    // 可能耗时 30-120 秒（iOS WASM 尤其慢），定期更新提示避免用户以为卡死
    let loadingHints = 0;
    const loadingHintMessages = [
      "下载完成，正在加载模型到内存…",
      "正在初始化推理引擎…（首次较慢，请耐心等待）",
      "正在编译模型算子…（iOS 上可能需要 1-2 分钟）",
      "仍在加载中…如果超过 3 分钟可点重试",
    ];
    const loadingHeartbeat = setInterval(() => {
      loadingHints = Math.min(loadingHints + 1, loadingHintMessages.length - 1);
      onProgress?.({
        stage: "loading",
        progress: 99,
        message: loadingHintMessages[loadingHints],
      });
    }, 15000);

    let generator: TfModule;
    try {
      // 加载超时检测：180 秒未完成则报错
      const loadPromise = tf.pipeline("text-generation", config.repo, {
        dtype,
        device: this.device,
        progress_callback: progressCallback,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "模型加载超时（3分钟）。可能是网络中断或内存不足，请重试。",
            ),
          );
        }, 180000);
      });
      generator = await Promise.race([loadPromise, timeoutPromise]);
    } catch (e) {
      if (e instanceof EngineLoadError) throw e;
      const msg = (e as Error)?.message ?? String(e);
      if (/fetch|network|Failed to|404|CORS|ERR_|locate/i.test(msg)) {
        throw new Error(
          `模型下载失败：${msg}。可尝试切换镜像源后重试。`,
        );
      }
      throw new Error(`模型加载失败：${msg}`);
    } finally {
      clearInterval(loadingHeartbeat);
    }

    onProgress?.({ stage: "ready", progress: 100, message: "模型就绪" });

    return { generator, modelId: this.modelId, device: this.device };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    this.aborted = false;
    const loaded = await this.ensureLoaded(params.onProgress);
    const tf = await loadTransformers();

    // 通知进入"思考中"阶段：首次推理需预热，可能数秒到数十秒才有第一个 token
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

    const elapsed = (lastTokenTime - firstTokenTime) / 1000;
    const promptText = params.messages.map((m) => m.content).join("");
    const usage: TokenUsage = {
      prompt: estimateTokens(promptText),
      completion: estimateTokens(content),
      total: 0,
    };
    usage.total = usage.prompt + usage.completion;

    return {
      content,
      usage: {
        ...usage,
        tokPerSec: elapsed > 0 ? usage.completion / elapsed : 0,
      } as TokenUsage & { tokPerSec: number },
    };
  }
}
