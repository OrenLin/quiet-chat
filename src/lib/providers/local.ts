// 本地推理 Provider：Transformers.js 3 + ONNX Runtime Web（WebGPU/WASM）
//
// 说明：@huggingface/transformers 的 npm 包会拉入 onnxruntime-node 原生二进制，
// 无法在浏览器构建中打包。因此这里通过 CDN 动态加载 ESM 版本（官方推荐用法），
// 库代码本身可由 Service Worker 缓存以支持离线；模型权重缓存于 IndexedDB。

import type { TokenUsage } from "../types";
import { estimateTokens } from "../crypto";
import { detectWebGPU, getModelById } from "../models";
import {
  type ChatParams,
  type ChatProvider,
  type ChatResult,
  type ProgressInfo,
  AbortError,
} from "./types";

const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TfModule = any;

let tfPromise: Promise<TfModule> | null = null;
function loadTransformers(): Promise<TfModule> {
  if (!tfPromise) {
    tfPromise = import(/* @vite-ignore */ TRANSFORMERS_CDN).then((mod) => {
      // 配置运行环境：使用远程模型 + 浏览器缓存
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      return mod;
    });
  }
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

  async isReady(): Promise<boolean> {
    return !!this.loaded;
  }

  getDevice(): string {
    return this.device;
  }

  abort(): void {
    this.aborted = true;
  }

  /** 加载（含首次下载）模型，带进度回调 */
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
    const tf = await loadTransformers();
    const config = getModelById(this.modelId);

    // 选择后端：优先 WebGPU，降级 WASM
    const hasWebGPU = await detectWebGPU();
    this.device = hasWebGPU ? "webgpu" : "wasm";

    onProgress?.({ stage: "downloading", progress: 0, message: "准备下载模型…" });

    const progressMap = new Map<string, number>();
    const progressCallback = (info: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
      if (info.file && typeof info.progress === "number") {
        progressMap.set(info.file, info.progress);
      }
      let avg = 0;
      if (progressMap.size > 0) {
        avg =
          Array.from(progressMap.values()).reduce((a, b) => a + b, 0) /
          progressMap.size;
      }
      if (info.status === "progress" || info.status === "download") {
        onProgress?.({
          stage: "downloading",
          progress: Math.min(99, Math.round(avg)),
          message: info.file ? `下载 ${info.file}` : "下载模型…",
        });
      } else if (info.status === "ready" || info.status === "done") {
        onProgress?.({ stage: "loading", progress: 99, message: "加载模型中…" });
      }
    };

    onProgress?.({ stage: "loading", progress: 99, message: "初始化推理引擎…" });

    const generator = await tf.pipeline("text-generation", config.repo, {
      dtype: config.dtype,
      device: this.device,
      progress_callback: progressCallback,
    });

    onProgress?.({ stage: "ready", progress: 100, message: "模型就绪" });

    return { generator, modelId: this.modelId, device: this.device };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    this.aborted = false;
    const loaded = await this.ensureLoaded(params.onProgress);
    const tf = await loadTransformers();
    const config = getModelById(this.modelId);

    let content = "";
    let firstTokenTime = 0;
    let lastTokenTime = 0;
    let tokenCount = 0;

    const streamer = new tf.TextStreamer(loaded.generator.tokenizer, {
      skip_prompt: true,
      callback_function: (text: string) => {
        if (this.aborted) throw new AbortError();
        if (!firstTokenTime) firstTokenTime = performance.now();
        lastTokenTime = performance.now();
        content += text;
        tokenCount++;
        params.onToken?.(text);
      },
    });

    try {
      // Transformers.js v3：传入消息数组，自动应用 chat template
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
    }

    // 估算 token 用量与速度
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
    // 通过 onProgress 透传速度信息（复用 ready 阶段）
    if (tokPerSec > 0) {
      params.onProgress?.({
        stage: "ready",
        progress: 100,
        message: `${tokPerSec.toFixed(1)} tok/s`,
      });
    }

    return { content, usage };
  }

  /** 卸载当前模型释放内存 */
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
