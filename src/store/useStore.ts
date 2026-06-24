// 全局状态管理（Zustand）：会话、设置、密钥、聊天流、本地模型
// 密钥材料（CryptoKey / 明文 API Key）仅存于模块级变量，不进入 React 状态或持久化。

import { create, type StoreApi } from "zustand";
import type {
  Session,
  Message,
  Settings,
  ChatMode,
  TokenUsage,
  BackendType,
  LocalModelStatus,
  DownloadProgress,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import {
  getAllSessions,
  putSession,
  deleteSession as dbDeleteSession,
  getMessages,
  putMessage,
  updateMessageContent,
} from "@/lib/db";
import { loadSettings, saveSettings, hasEncryptedKey } from "@/lib/settings";
import {
  deriveKey,
  encryptString,
  decryptString,
  bytesToBase64,
  base64ToBytes,
} from "@/lib/crypto";
import { DeepSeekProvider } from "@/lib/providers/deepseek";
import { LocalProvider } from "@/lib/providers/local";
import { AbortError, type ProgressInfo } from "@/lib/providers/types";
import { detectWebGPU } from "@/lib/models";

// ---- 模块级密钥材料（仅内存） ----
let cryptoKey: CryptoKey | null = null;
let rawApiKey: string | null = null;
let localProvider: LocalProvider | null = null;
let deepseekProvider: DeepSeekProvider | null = null;

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getLocalProvider(modelId: string): LocalProvider {
  if (!localProvider) {
    localProvider = new LocalProvider(modelId);
  } else {
    localProvider.setModel(modelId);
  }
  return localProvider;
}

function getDeepSeekProvider(key: string, model: string): DeepSeekProvider {
  if (!deepseekProvider) {
    deepseekProvider = new DeepSeekProvider(key, model);
  } else {
    deepseekProvider.setApiKey(key);
    deepseekProvider.setModel(model);
  }
  return deepseekProvider;
}

interface ChatState {
  // 数据
  sessions: Session[];
  currentSessionId: string | null;
  messagesBySession: Record<string, Message[]>;
  settings: Settings;
  hydrated: boolean;

  // 密钥
  isKeyUnlocked: boolean;
  needsKeySetup: boolean; // 是否需要设置加密密码

  // 聊天流
  isGenerating: boolean;
  streamingMessageId: string | null;
  tokenUsage: TokenUsage | null;
  error: string | null;

  // 本地模型
  localStatus: LocalModelStatus;
  localProgress: number;
  localMessage: string;
  backend: BackendType;
  tokPerSec: number;
  downloadProgress: DownloadProgress | null;

  // 初始化
  hydrate: () => Promise<void>;

  // 会话
  createSession: (mode?: ChatMode) => Promise<Session>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  newChat: () => void;

  // 密钥
  unlockKey: (password: string) => Promise<boolean>;
  lockKey: () => void;
  saveApiKey: (apiKey: string, password: string) => Promise<void>;
  clearApiKey: () => void;
  testApiKey: () => Promise<boolean>;

  // 设置
  updateSettings: (patch: Partial<Settings>) => void;
  setMode: (mode: ChatMode) => void;

  // 聊天
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
  regenerate: () => Promise<void>;

  // 本地模型
  preloadLocalModel: () => Promise<void>;
}

export const useStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messagesBySession: {},
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,

  isKeyUnlocked: false,
  needsKeySetup: false,

  isGenerating: false,
  streamingMessageId: null,
  tokenUsage: null,
  error: null,

  localStatus: "idle",
  localProgress: 0,
  localMessage: "",
  backend: "unknown",
  tokPerSec: 0,
  downloadProgress: null,

  hydrate: async () => {
    const settings = loadSettings();
    const sessions = await getAllSessions();
    set({
      settings,
      sessions,
      needsKeySetup: hasEncryptedKey(settings),
      hydrated: true,
    });
    // 请求持久化存储，防止手机浏览器在空间不足时清理已下载的模型
    if (navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        /* 忽略 */
      }
    }
    // 检测后端
    const gpu = await detectWebGPU();
    set({ backend: gpu ? "webgpu" : "wasm" });
  },

  createSession: async (mode) => {
    const settings = get().settings;
    const m = mode ?? settings.mode;
    const session: Session = {
      id: uid(),
      title: "新对话",
      mode: m,
      model: m === "deepseek" ? settings.cloudModel : settings.localModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await putSession(session);
    set((s) => ({
      sessions: [session, ...s.sessions],
      currentSessionId: session.id,
      messagesBySession: { ...s.messagesBySession, [session.id]: [] },
    }));
    return session;
  },

  selectSession: async (id) => {
    set({ currentSessionId: id, error: null });
    if (!get().messagesBySession[id]) {
      const msgs = await getMessages(id);
      set((s) => ({ messagesBySession: { ...s.messagesBySession, [id]: msgs } }));
    }
  },

  deleteSession: async (id) => {
    await dbDeleteSession(id);
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      const messagesBySession = { ...s.messagesBySession };
      delete messagesBySession[id];
      const currentSessionId =
        s.currentSessionId === id ? sessions[0]?.id ?? null : s.currentSessionId;
      return { sessions, messagesBySession, currentSessionId };
    });
  },

  renameSession: async (id, title) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    const updated = { ...session, title, updatedAt: Date.now() };
    await putSession(updated);
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? updated : x)),
    }));
  },

  newChat: () => {
    set({ currentSessionId: null, error: null, tokenUsage: null });
  },

  // ---- 密钥管理 ----

  unlockKey: async (password) => {
    const { settings } = get();
    if (!hasEncryptedKey(settings)) return false;
    try {
      const salt = base64ToBytes(settings.keySalt!);
      const iv = base64ToBytes(settings.keyIv!);
      const ciphertext = base64ToBytes(settings.encryptedKey!);
      const key = await deriveKey(password, salt);
      const decrypted = await decryptString(key, ciphertext, iv);
      cryptoKey = key;
      rawApiKey = decrypted;
      set({ isKeyUnlocked: true, needsKeySetup: false });
      return true;
    } catch {
      return false;
    }
  },

  lockKey: () => {
    cryptoKey = null;
    rawApiKey = null;
    set({ isKeyUnlocked: false, needsKeySetup: hasEncryptedKey(get().settings) });
  },

  saveApiKey: async (apiKey, password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    const { ciphertext, iv } = await encryptString(key, apiKey);
    const newSettings: Settings = {
      ...get().settings,
      encryptedKey: bytesToBase64(ciphertext),
      keySalt: bytesToBase64(salt),
      keyIv: bytesToBase64(iv),
    };
    cryptoKey = key;
    rawApiKey = apiKey;
    saveSettings(newSettings);
    set({ settings: newSettings, isKeyUnlocked: true, needsKeySetup: false });
  },

  clearApiKey: () => {
    cryptoKey = null;
    rawApiKey = null;
    const newSettings: Settings = {
      ...get().settings,
      encryptedKey: null,
      keySalt: null,
      keyIv: null,
    };
    saveSettings(newSettings);
    set({
      settings: newSettings,
      isKeyUnlocked: false,
      needsKeySetup: false,
    });
  },

  testApiKey: async () => {
    const { settings } = get();
    if (!rawApiKey) return false;
    try {
      const resp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawApiKey}`,
        },
        body: JSON.stringify({
          model: settings.cloudModel,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
          stream: false,
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  },

  // ---- 设置 ----

  updateSettings: (patch) => {
    const newSettings = { ...get().settings, ...patch };
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  setMode: (mode) => {
    get().updateSettings({ mode });
  },

  // ---- 聊天 ----

  sendMessage: async (text) => {
    const state = get();
    if (state.isGenerating || !text.trim()) return;

    set({ error: null, tokenUsage: null });

    // 确保有会话
    let sessionId = state.currentSessionId;
    let session = state.sessions.find((s) => s.id === sessionId) ?? null;
    if (!session) {
      session = await get().createSession();
      sessionId = session.id;
    }

    const now = Date.now();
    const userMsg: Message = {
      id: uid(),
      sessionId,
      role: "user",
      content: text.trim(),
      createdAt: now,
    };
    const assistantMsg: Message = {
      id: uid(),
      sessionId,
      role: "assistant",
      content: "",
      createdAt: now + 1,
    };

    // 更新状态 + 持久化用户消息
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [
          ...(s.messagesBySession[sessionId] ?? []),
          userMsg,
          assistantMsg,
        ],
      },
      isGenerating: true,
      streamingMessageId: assistantMsg.id,
    }));
    await putMessage(userMsg);

    // 构建上下文消息
    const history = get().messagesBySession[sessionId] ?? [];
    const chatMessages = history
      .filter((m) => m.id !== assistantMsg.id && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    // 首条消息设为会话标题
    if (session.title === "新对话") {
      const title = text.trim().slice(0, 24) + (text.length > 24 ? "…" : "");
      await get().renameSession(sessionId, title);
    }

    await runChat(get, set, sessionId, assistantMsg, chatMessages);
  },

  stopGeneration: () => {
    const state = get();
    if (!state.isGenerating) return;
    if (state.settings.mode === "deepseek" && deepseekProvider) {
      deepseekProvider.abort();
    } else if (state.settings.mode === "local" && localProvider) {
      localProvider.abort();
    }
  },

  regenerate: async () => {
    const state = get();
    if (state.isGenerating) return;
    const sessionId = state.currentSessionId;
    if (!sessionId) return;
    const msgs = state.messagesBySession[sessionId] ?? [];
    if (msgs.length < 2) return;
    // 移除最后一条助手消息，基于上一条用户消息重新生成
    const lastAssistant = msgs[msgs.length - 1];
    if (lastAssistant.role !== "assistant") return;
    const remaining = msgs.slice(0, -1);
    const chatMessages = remaining
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    const newAssistant: Message = {
      id: uid(),
      sessionId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...remaining, newAssistant],
      },
      isGenerating: true,
      streamingMessageId: newAssistant.id,
      tokenUsage: null,
      error: null,
    }));
    await runChat(get, set, sessionId, newAssistant, chatMessages);
  },

  // ---- 本地模型预加载 ----

  preloadLocalModel: async () => {
    const { settings } = get();
    if (settings.mode !== "local") return;
    const provider = getLocalProvider(settings.localModel);
    if (await provider.isReady()) {
      set({ localStatus: "ready", localProgress: 100, localMessage: "模型就绪" });
      return;
    }
    set({ localStatus: "downloading", localProgress: 0, localMessage: "准备下载…" });
    try {
      await provider.ensureLoaded((info: ProgressInfo) => {
        if (info.stage === "downloading") {
          set({
            localStatus: "downloading",
            localProgress: info.progress,
            localMessage: info.message ?? "下载中…",
          });
        } else if (info.stage === "loading") {
          set({ localStatus: "loading", localProgress: info.progress, localMessage: info.message ?? "加载中…" });
        } else if (info.stage === "ready") {
          const msg = info.message ?? "模型就绪";
          const tokMatch = msg.match(/([\d.]+)\s*tok\/s/);
          set({
            localStatus: "ready",
            localProgress: 100,
            localMessage: msg,
            tokPerSec: tokMatch ? parseFloat(tokMatch[1]) : get().tokPerSec,
          });
        }
      });
      set({ localStatus: "ready", localProgress: 100, localMessage: "模型就绪" });
    } catch (e) {
      set({
        localStatus: "error",
        localMessage: (e as Error).message ?? "加载失败",
      });
    }
  },
}));

// ---- 内部：执行一次对话生成 ----

async function runChat(
  get: () => ChatState,
  set: StoreApi<ChatState>["setState"],
  sessionId: string,
  assistantMsg: Message,
  chatMessages: { role: "system" | "user" | "assistant"; content: string }[],
) {
  const settings = get().settings;
  const updateAssistant = (content: string) => {
    set((s: ChatState) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
          m.id === assistantMsg.id ? { ...m, content } : m,
        ),
      },
    }));
  };

  try {
    let result;
    if (settings.mode === "deepseek") {
      if (!rawApiKey) {
        throw new Error("API Key 未解锁，请先输入密码解锁或前往设置配置。");
      }
      const provider = getDeepSeekProvider(rawApiKey, settings.cloudModel);
      result = await provider.chat({
        messages: chatMessages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        onToken: (delta) => {
          const cur = get().messagesBySession[sessionId]?.find(
            (m) => m.id === assistantMsg.id,
          );
          updateAssistant((cur?.content ?? "") + delta);
        },
        onUsage: (usage) => set({ tokenUsage: usage }),
      });
    } else {
      const provider = getLocalProvider(settings.localModel);
      set({ localStatus: "loading", localMessage: "推理中…" });
      result = await provider.chat({
        messages: chatMessages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        onProgress: (info: ProgressInfo) => {
          if (info.stage === "downloading") {
            set({ localStatus: "downloading", localProgress: info.progress, localMessage: info.message ?? "下载中…" });
          } else if (info.stage === "loading") {
            set({ localStatus: "loading", localProgress: info.progress, localMessage: info.message ?? "加载中…" });
          } else if (info.stage === "ready") {
            const tokMatch = (info.message ?? "").match(/([\d.]+)\s*tok\/s/);
            if (tokMatch) set({ tokPerSec: parseFloat(tokMatch[1]) });
          }
        },
        onToken: (delta) => {
          const cur = get().messagesBySession[sessionId]?.find(
            (m) => m.id === assistantMsg.id,
          );
          updateAssistant((cur?.content ?? "") + delta);
        },
        onUsage: (usage) => set({ tokenUsage: usage }),
      });
      set({ localStatus: "ready", localMessage: "就绪" });
    }

    // 持久化最终助手消息
    assistantMsg.content = result.content;
    assistantMsg.tokens = result.usage?.completion;
    await putMessage(assistantMsg);
    // 更新会话时间
    const session = get().sessions.find((s) => s.id === sessionId);
    if (session) {
      const updated = { ...session, updatedAt: Date.now() };
      await putSession(updated);
      set((s: ChatState) => ({
        sessions: [updated, ...s.sessions.filter((x) => x.id !== sessionId)],
      }));
    }
  } catch (e) {
    if (e instanceof AbortError || (e as Error)?.name === "AbortError") {
      // 中止：保留已生成内容
      assistantMsg.content =
        get().messagesBySession[sessionId]?.find((m) => m.id === assistantMsg.id)
          ?.content ?? "";
      if (assistantMsg.content) {
        await putMessage(assistantMsg);
      }
    } else {
      const msg = (e as Error).message ?? "生成失败";
      set({ error: msg });
      assistantMsg.content = `⚠️ ${msg}`;
      assistantMsg.error = true;
      await putMessage(assistantMsg);
    }
  } finally {
    set({ isGenerating: false, streamingMessageId: null });
  }
}
