// Provider 抽象层

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
}

export interface ChatResult {
  content: string;
  usage?: TokenUsage;
}

export interface ChatProvider {
  id: "deepseek";
  /** 是否就绪（Key 已解锁） */
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
