// IndexedDB 存储层：会话、消息、模型权重缓存（通过 idb 封装）
// 模型权重由自定义下载器断点续传下载后存入 modelFiles store，
// 再由 Transformers.js 通过 env.localModelPath 从本地加载。

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Session, Message } from "./types";

/** 模型文件缓存记录 */
export interface ModelFileRecord {
  /** key: `${repo}/${path}` */
  key: string;
  /** 完整文件字节 */
  blob: Blob;
  /** 文件大小（字节） */
  size: number;
  /** 下载完成时间 */
  downloadedAt: number;
}

interface ChatDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { "by-updated": number };
  };
  messages: {
    key: string;
    value: Message;
    indexes: { "by-session": string };
  };
  modelFiles: {
    key: string;
    value: ModelFileRecord;
  };
}

const DB_NAME = "llm-chat-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ChatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains("messages")) {
          const store = db.createObjectStore("messages", { keyPath: "id" });
          store.createIndex("by-session", "sessionId");
        }
        if (!db.objectStoreNames.contains("modelFiles")) {
          db.createObjectStore("modelFiles");
        }
      },
    });
  }
  return dbPromise;
}

// ---- 会话操作 ----

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessions", "by-updated");
  return all.reverse(); // 最新在前
}

export async function putSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "messages"], "readwrite");
  await tx.objectStore("sessions").delete(sessionId);
  const idx = tx.objectStore("messages").index("by-session");
  let cursor = await idx.openCursor(sessionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ---- 消息操作 ----

export async function getMessages(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("messages", "by-session", sessionId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putMessage(message: Message): Promise<void> {
  const db = await getDB();
  await db.put("messages", message);
}

export async function updateMessageContent(
  messageId: string,
  content: string,
  tokens?: number,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("messages", messageId);
  if (!existing) return;
  existing.content = content;
  if (tokens !== undefined) existing.tokens = tokens;
  await db.put("messages", existing);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const db = await getDB();
  await db.delete("messages", messageId);
}

/** 估算 IndexedDB 已用空间（字节） */
export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}

// ---- 模型文件缓存操作 ----

/** 获取已缓存的模型文件，不存在返回 null */
export async function getModelFile(key: string): Promise<ModelFileRecord | null> {
  const db = await getDB();
  return (await db.get("modelFiles", key)) ?? null;
}

/** 保存模型文件到缓存 */
export async function putModelFile(record: ModelFileRecord): Promise<void> {
  const db = await getDB();
  await db.put("modelFiles", record);
}

/** 删除指定模型文件缓存 */
export async function deleteModelFile(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("modelFiles", key);
}

/** 删除指定 repo 前缀的所有模型文件缓存 */
export async function deleteModelFilesByRepo(repo: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("modelFiles", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.key.toString().startsWith(repo + "/")) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** 列出所有已缓存的模型文件 key */
export async function listModelFiles(): Promise<string[]> {
  const db = await getDB();
  const allKeys = await db.getAllKeys("modelFiles");
  return allKeys.map((k) => k.toString());
}
