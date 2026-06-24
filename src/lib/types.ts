// 共享类型定义

export type ChatMode = "deepseek" | "local";
export type Role = "system" | "user" | "assistant";

export interface Session {
  id: string;
  title: string;
  mode: ChatMode;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  tokens?: number;
  createdAt: number;
  error?: boolean;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatMessage {
  role: Role;
  content: string;
}

/** 持久化到 localStorage 的设置（API Key 仅存密文） */
export interface Settings {
  /** AES-GCM 密文（base64），null 表示未设置 */
  encryptedKey: string | null;
  /** PBKDF2 盐（base64） */
  keySalt: string | null;
  /** AES-GCM IV（base64） */
  keyIv: string | null;
  mode: ChatMode;
  cloudModel: string;
  localModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  onlineSearch: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  encryptedKey: null,
  keySalt: null,
  keyIv: null,
  mode: "deepseek",
  cloudModel: "deepseek-chat",
  localModel: "qwen3-0.6b-q4",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
  onlineSearch: false,
};

export type BackendType = "webgpu" | "wasm" | "unknown";
export type LocalModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export interface DownloadProgress {
  modelId: string;
  file: string;
  progress: number; // 0-100
  loaded: number;
  total: number;
}
