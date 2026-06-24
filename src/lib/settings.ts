// 设置持久化：localStorage 存储（含加密后的 API Key 密文）
// 派生密钥与明文 Key 仅存于内存，不在此处持久化。

import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS_KEY = "llm-chat:settings";
const VERSION_KEY = "llm-chat:version";
const DATA_VERSION = "1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(VERSION_KEY, DATA_VERSION);
  } catch (e) {
    console.error("保存设置失败", e);
  }
}

/** 是否已加密保存 API Key */
export function hasEncryptedKey(settings: Settings): boolean {
  return !!(settings.encryptedKey && settings.keySalt && settings.keyIv);
}
