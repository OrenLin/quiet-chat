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

// 模型权重镜像源
const MIRROR_HOSTS = {
  hf: "https://huggingface.co",
  "hf-mirror": "https://hf-mirror.com",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TfModule = any;

let tfPromise: Promise<TfModule> | null = null;
let currentMirror: "auto" | "hf" | "hf-mirror" = "auto";

/** 引擎（Transformers.js 库）加载失败 —— 通常是 CDN 网络问题 */
export class EngineLoadError extends Error {
  constructor(public readonly triedHosts: string[]) {
    super(
      "推理引擎加载失败：所有 CDN 均无法访问。请检查网络后重试，或切换 Wi-Fi / 移动数据。",
    );
    this.name = "EngineLoadError";
  }
}

function loadTransformers(
  mirror: "auto" | "hf" | "hf-mirror",
): Promise<TfModule> {
  currentMirror = mirror;
  if (tfPromise) return tfPromise;

  tfPromise = (async () => {
    const tried: string[] = [];
    for (const cdn of TRANSFORMERS_CDNS) {
      tried.push(cdn);
      try {
        const mod = await import(/* @vite-ignore */ cdn);
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
        applyMirror(mod, mirror);
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

function applyMirror(mod: TfModule, mirror: "auto" | "hf" | "hf-mirror") {
  if (mirror === "hf") {
    mod.env.remoteHost = MIRROR_HOSTS.hf;
  } else if (mirror === "hf-mirror") {
    mod.env.remoteHost = MIRROR_HOSTS["hf-mirror"];
  }
  // auto: 不修改，用默认 huggingface.co
}

interface LoadedModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any;
  modelId: string;
  device: string;
}

// 文件下载跟踪
interface FileProgress {
  name: string;
  progress: number; // 0-100
  loaded: number;
  total: number;
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
  }

  /** 加载（含首次下载）模型，带详细进度回调 */
  async ensureLoaded(
    onProgress?: (info: ProgressInfo) => void,
  ): Promise<LoadedModel> {
    if (this.loaded) return this.loaded;
    if (this.loadingPromise) return this.loadingPromise;

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
    const tf = await loadTransformers(this.mirror);
    // 动态应用镜像（库已加载但镜像可能变了）
    applyMirror(tf, this.mirror);

    const config = getModelById(this.modelId);

    // 选择后端：iOS 强制 WASM，其他优先 WebGPU 降级 WASM
    onProgress?.({ stage: "init", progress: 5, message: "检测推理后端…" });
    const { device, reason } = await pickDevice();
    this.device = device;
    onProgress?.({ stage: "init", progress: 8, message: reason });

    onProgress?.({
      stage: "downloading",
      progress: 0,
      message: `开始下载 ${config.name}（${config.sizeLabel}）`,
      filesCompleted: 0,
      filesTotal: 0,
    });

    // 文件级进度跟踪
    const fileMap = new Map<string, FileProgress>();
    const fileOrder: string[] = [];
    let lastSpeedTime = 0;
    let lastSpeedLoaded = 0;
    let speedBps = 0;
    let stuckCount = 0;
    let lastProgressTime = Date.now();

    const progressCallback = (info: {
      status?: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
      name?: string;
    }) => {
      const file = info.file || info.name;
      const now = Date.now();

      if (file && !fileMap.has(file)) {
        fileMap.set(file, {
          name: file,
          progress: 0,
          loaded: 0,
          total: 0,
        });
        fileOrder.push(file);
      }

      if (file && typeof info.progress === "number") {
        const fp = fileMap.get(file)!;
        const wasComplete = fp.progress >= 100;
        fp.progress = info.progress;
        fp.loaded = info.loaded ?? fp.loaded;
        fp.total = info.total ?? fp.total;

        // 计算速度（每 500ms 采样一次）
        const totalLoaded = Array.from(fileMap.values()).reduce(
          (s, f) => s + f.loaded,
          0,
        );
        if (now - lastSpeedTime > 500) {
          if (lastSpeedTime > 0 && totalLoaded > lastSpeedLoaded) {
            speedBps = ((totalLoaded - lastSpeedLoaded) / (now - lastSpeedTime)) * 1000;
            stuckCount = 0;
            lastProgressTime = now;
          } else if (now - lastProgressTime > 5000) {
            // 5 秒无进度变化，可能卡住
            stuckCount++;
          }
          lastSpeedTime = now;
          lastSpeedLoaded = totalLoaded;
        }

        const filesCompleted = Array.from(fileMap.values()).filter(
          (f) => f.progress >= 100,
        ).length;
        const filesTotal = fileMap.size;

        // 总进度：基于字节（更准确），回退到文件数
        const totalBytes = Array.from(fileMap.values()).reduce(
          (s, f) => s + f.total,
          0,
        );
        let overallProgress: number;
        if (totalBytes > 0) {
          overallProgress = Math.min(99, (totalLoaded / totalBytes) * 100);
        } else {
          overallProgress =
            filesTotal > 0
              ? Math.min(99, (filesCompleted / filesTotal) * 100)
              : 0;
        }

        // ETA
        let etaSeconds: number | undefined;
        if (speedBps > 0 && totalBytes > 0) {
          etaSeconds = Math.max(0, (totalBytes - totalLoaded) / speedBps);
        }

        const shortName = file.split("/").pop() || file;
        const stuck = stuckCount > 2 && !wasComplete;

        onProgress?.({
          stage: "downloading",
          progress: Math.round(overallProgress),
          message: stuck
            ? `下载似乎较慢，可尝试切换镜像源`
            : `下载 ${shortName}`,
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
        // 单个文件完成
        if (file) {
          const fp = fileMap.get(file);
          if (fp) fp.progress = 100;
        }
      }
    };

    onProgress?.({
      stage: "loading",
      progress: 99,
      message: "加载模型到内存…",
    });

    let generator: TfModule;
    try {
      generator = await tf.pipeline("text-generation", config.repo, {
        dtype: config.dtype,
        device: this.device,
        progress_callback: progressCallback,
      });
    } catch (e) {
      if (e instanceof EngineLoadError) throw e;
      const msg = (e as Error)?.message ?? String(e);
      // 常见模型下载失败：网络中断 / 404 / CORS
      if (/fetch|network|Failed to|404|CORS|ERR_/i.test(msg)) {
        throw new Error(
          `模型下载失败：${msg}。可尝试切换「国内镜像」源后重试。`,
        );
      }
      throw new Error(`模型加载失败：${msg}`);
    }

    onProgress?.({ stage: "ready", progress: 100, message: "模型就绪" });

    return { generator, modelId: this.modelId, device: this.device };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    this.aborted = false;
    const loaded = await this.ensureLoaded(params.onProgress);
    const tf = await loadTransformers(this.mirror);

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
