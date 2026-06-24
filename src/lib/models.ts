// 本地模型配置表
// Transformers.js 3 在浏览器中运行 ONNX 格式模型，权重缓存于 IndexedDB。

export interface LocalModelConfig {
  id: string;
  name: string;
  repo: string; // HuggingFace 仓库
  dtype: string; // 量化精度：q4 / q8 / fp16 ...
  sizeLabel: string; // 展示体积
  approxBytes: number; // 估算字节数
  quality: number; // 质量 1-5
  description: string;
  recommended?: boolean;
}

export const LOCAL_MODELS: LocalModelConfig[] = [
  {
    id: "qwen2.5-0.5b-q4",
    name: "Qwen2.5-0.5B",
    repo: "onnx-community/Qwen2.5-0.5B-Instruct",
    dtype: "q4",
    sizeLabel: "~250MB",
    approxBytes: 250 * 1024 * 1024,
    quality: 2,
    description: "极致轻量，移动端首选，速度最快。",
  },
  {
    id: "qwen3-0.6b-q4",
    name: "Qwen3-0.6B (Q4)",
    repo: "onnx-community/Qwen3-0.6B",
    dtype: "q4",
    sizeLabel: "~400MB",
    approxBytes: 400 * 1024 * 1024,
    quality: 3,
    description: "平衡选择，推荐默认，桌面与移动皆宜。",
    recommended: true,
  },
  {
    id: "qwen3-0.6b-q8",
    name: "Qwen3-0.6B (Q8)",
    repo: "onnx-community/Qwen3-0.6B",
    dtype: "q8",
    sizeLabel: "~600MB",
    approxBytes: 600 * 1024 * 1024,
    quality: 4,
    description: "质量稍好，适合桌面端。",
  },
];

export function getModelById(id: string): LocalModelConfig {
  return LOCAL_MODELS.find((m) => m.id === id) ?? LOCAL_MODELS[1];
}

/** 检测当前环境是否支持 WebGPU */
export async function detectWebGPU(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export function detectWASM(): boolean {
  return typeof WebAssembly !== "undefined";
}

/** 检测是否为 iOS / iPadOS（iPadOS 13+ 伪装为 Mac，需结合触屏判断） */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPadOS =
    /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return /iPhone|iPad|iPod/.test(ua) || isIPadOS;
}

/**
 * 选择推理后端：iOS 强制 WASM（WebGPU 在 iOS Safari 上对 ONNX 模型支持不稳定，
 * 易出现 shader 编译失败或内存崩溃）；其他平台优先 WebGPU 降级 WASM。
 */
export async function pickDevice(): Promise<{ device: string; reason: string }> {
  if (isIOS()) {
    return { device: "wasm", reason: "iOS 使用 WASM（兼容性最佳）" };
  }
  const hasWebGPU = await detectWebGPU();
  if (hasWebGPU) {
    return { device: "webgpu", reason: "WebGPU 加速" };
  }
  return { device: "wasm", reason: "WASM（未检测到 WebGPU）" };
}
