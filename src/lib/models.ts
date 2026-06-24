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
    repo: "Qwen/Qwen2.5-0.5B-Instruct",
    dtype: "q4",
    sizeLabel: "~250MB",
    approxBytes: 250 * 1024 * 1024,
    quality: 2,
    description: "极致轻量，移动端首选，速度最快。",
  },
  {
    id: "qwen3-0.6b-q4",
    name: "Qwen3-0.6B (Q4)",
    repo: "Qwen/Qwen3-0.6B",
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
    repo: "Qwen/Qwen3-0.6B",
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
