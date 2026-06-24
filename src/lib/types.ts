// 共享类型定义

export type Role = "system" | "user" | "assistant";

export interface Session {
  id: string;
  title: string;
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
  cloudModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  onlineSearch: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  encryptedKey: null,
  keySalt: null,
  keyIv: null,
  cloudModel: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
  onlineSearch: false,
};
