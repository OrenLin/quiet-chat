// Provider 抽象层：统一云端与本地推理接口

import type { ChatMessage, TokenUsage } from "../types";

export interface ChatParams {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  topP: number;
  signal?: AbortSignal;
  /** 每收到一段增量文本时回调 */
  onToken?: (delta: string) => void;
  /** 推理完成或更新用量时回调 */
  onUsage?: (usage: TokenUsage) => void;
  /** 本地模型加载/下载进度 */
  onProgress?: (info: ProgressInfo) => void;
}

export interface ProgressInfo {
  /** init=初始化引擎, downloading=下载权重, loading=加载到内存, ready=就绪 */
  stage: "init" | "downloading" | "loading" | "ready";
  progress: number; // 0-100 总进度
  message?: string;
  // 文件级详情（仅 downloading 阶段）
  currentFile?: string;
  fileProgress?: number; // 当前文件 0-100
  filesCompleted?: number;
  filesTotal?: number;
  // 字节与速度（仅 downloading 阶段）
  loadedBytes?: number;
  totalBytes?: number;
  speedBps?: number; // bytes/sec
  etaSeconds?: number;
}

export interface ChatResult {
  content: string;
  usage?: TokenUsage;
}

export interface ChatProvider {
  id: "deepseek" | "local";
  /** 是否就绪（云端：Key 已解锁；本地：模型已加载） */
  isReady(): Promise<boolean>;
  /** 执行一次流式对话 */
  chat(params: ChatParams): Promise<ChatResult>;
  /** 中止当前生成 */
  abort(): void;
}

export class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}
