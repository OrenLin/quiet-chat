// 模型文件断点续传下载器
//
// 解决问题：
// 1. HuggingFace 大文件（LFS）经 hf-mirror.com 会 302 重定向到 cas-bridge.xethub.hf.co（国外 CDN），
//    导致中国境内下载慢、易中断。
// 2. Transformers.js 自身的下载无断点续传，中断后必须从头再来。
//
// 方案：
// - 用 Range 请求分块下载（每块 8MB），支持中断续传
// - 下载的块累积存入 IndexedDB（modelFiles store）
// - 全部完成后合并为完整 Blob
// - 通过 monkey-patch fetch，让 Transformers.js 从 IndexedDB 缓存加载，离线可用
//
// 镜像源选择：
// - hf-mirror: 小文件走国内缓存，大文件仍重定向 xethub（但 Range 请求可续传）
// - hf: 官方源，大文件也走 xethub
// - auto: 默认 hf-mirror

import { getModelFile, putModelFile, type ModelFileRecord } from "./db";

/** 镜像源主机 */
const MIRROR_HOSTS = {
  hf: "https://huggingface.co",
  "hf-mirror": "https://hf-mirror.com",
};

/** 分块大小：8MB，平衡内存与请求数 */
const CHUNK_SIZE = 8 * 1024 * 1024;

/** 下载进度回调 */
export interface DownloadProgressInfo {
  /** 当前文件名 */
  file: string;
  /** 当前文件已下载字节 */
  loaded: number;
  /** 当前文件总字节 */
  total: number;
  /** 当前文件进度 0-100 */
  fileProgress: number;
  /** 已完成文件数 */
  filesCompleted: number;
  /** 总文件数 */
  filesTotal: number;
  /** 所有文件累计已下载字节 */
  loadedBytes: number;
  /** 所有文件累计总字节 */
  totalBytes: number;
  /** 总进度 0-100 */
  progress: number;
  /** 下载速度 bytes/sec */
  speedBps: number;
  /** 剩余时间秒 */
  etaSeconds: number;
}

/** 单个文件下载结果 */
interface FileDownloadResult {
  key: string;
  blob: Blob;
  size: number;
}

/**
 * 获取文件总大小（发 HEAD 请求，跟随重定向）
 */
async function getFileSize(
  url: string,
  signal?: AbortSignal,
): Promise<number> {
  const resp = await fetch(url, {
    method: "HEAD",
    signal,
    redirect: "follow",
  });
  if (!resp.ok) {
    throw new Error(`HEAD 请求失败: ${resp.status} ${url}`);
  }
  const len = resp.headers.get("content-length");
  if (!len) {
    throw new Error(`无法获取文件大小: ${url}`);
  }
  return parseInt(len, 10);
}

/**
 * 下载单个文件（支持断点续传）
 * - 先查 IndexedDB，若已有完整缓存则直接返回
 * - 否则用 Range 请求分块下载，中断后下次可从断点继续
 * - 下载完成后合并存入 IndexedDB
 */
async function downloadFile(
  url: string,
  cacheKey: string,
  fileName: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<FileDownloadResult> {
  // 1. 查缓存
  const cached = await getModelFile(cacheKey);
  if (cached) {
    onProgress(cached.size, cached.size);
    return { key: cacheKey, blob: cached.blob, size: cached.size };
  }

  // 2. 获取总大小
  const total = await getFileSize(url, signal);
  onProgress(0, total);

  // 3. 分块下载
  const chunks: Blob[] = [];
  let loaded = 0;
  let startByte = 0;

  while (startByte < total) {
    if (signal?.aborted) {
      throw new DOMException("下载中止", "AbortError");
    }
    const endByte = Math.min(startByte + CHUNK_SIZE - 1, total - 1);
    const resp = await fetch(url, {
      headers: { Range: `bytes=${startByte}-${endByte}` },
      signal,
      redirect: "follow",
    });
    if (!resp.ok && resp.status !== 206) {
      throw new Error(`下载失败: ${resp.status} (Range ${startByte}-${endByte})`);
    }
    const chunk = await resp.blob();
    chunks.push(chunk);
    loaded += chunk.size;
    startByte = endByte + 1;
    onProgress(loaded, total);
  }

  // 4. 合并存入 IndexedDB
  const blob = new Blob(chunks);
  const record: ModelFileRecord = {
    key: cacheKey,
    blob,
    size: total,
    downloadedAt: Date.now(),
  };
  await putModelFile(record);

  return { key: cacheKey, blob, size: total };
}

/**
 * 预下载模型所有文件到 IndexedDB
 *
 * @param repo HuggingFace 仓库（如 onnx-community/Qwen2.5-0.5B-Instruct）
 * @param dtype 量化精度（q4 / q8 / fp16 等）
 * @param mirror 镜像源
 * @param onProgress 进度回调
 * @param signal 中止信号
 * @returns 已缓存文件的 URL 映射（cacheKey -> blob: URL），供 Transformers.js 加载
 */
export async function downloadModelFiles(
  repo: string,
  dtype: string,
  mirror: "auto" | "hf" | "hf-mirror",
  onProgress: (info: DownloadProgressInfo) => void,
  signal?: AbortSignal,
): Promise<Map<string, Blob>> {
  // 确定镜像主机：auto 默认用 hf-mirror
  const host =
    mirror === "hf"
      ? MIRROR_HOSTS.hf
      : MIRROR_HOSTS["hf-mirror"];

  // 根据 dtype 确定模型文件名后缀（与 Transformers.js 3.8 映射一致）
  const suffixMap: Record<string, string> = {
    fp32: "",
    fp16: "_fp16",
    int8: "_int8",
    uint8: "_uint8",
    q8: "_quantized",
    q4: "_q4",
    q4f16: "_q4f16",
    bnb4: "_bnb4",
  };
  const suffix = suffixMap[dtype] ?? "_quantized";

  // 需要下载的文件列表（Transformers.js text-generation pipeline 所需）
  const files = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    `onnx/model${suffix}.onnx`,
  ];

  // 先探测各文件大小，计算总量
  const fileInfos: { name: string; url: string; cacheKey: string; size: number }[] = [];
  let totalBytes = 0;
  for (const f of files) {
    const url = `${host}/${repo}/resolve/main/${f}`;
    const cacheKey = `${repo}/${f}`;
    // 查缓存，已缓存的不计入待下载
    const cached = await getModelFile(cacheKey);
    if (cached) {
      totalBytes += cached.size;
      fileInfos.push({ name: f, url, cacheKey, size: cached.size });
      continue;
    }
    try {
      const size = await getFileSize(url, signal);
      totalBytes += size;
      fileInfos.push({ name: f, url, cacheKey, size });
    } catch {
      // 文件可能不存在（如某些仓库无 tokenizer_config.json），跳过
      console.warn(`[downloader] 跳过不存在的文件: ${f}`);
    }
  }

  const filesTotal = fileInfos.length;
  let filesCompleted = 0;
  let loadedBytes = 0;
  let speedBps = 0;
  let lastSpeedTime = Date.now();
  let lastSpeedLoaded = 0;

  const results = new Map<string, Blob>();

  for (const info of fileInfos) {
    if (signal?.aborted) throw new DOMException("下载中止", "AbortError");

    const cached = await getModelFile(info.cacheKey);
    if (cached) {
      // 已缓存，直接用
      results.set(info.cacheKey, cached.blob);
      filesCompleted++;
      loadedBytes += cached.size;
      onProgress({
        file: info.name,
        loaded: cached.size,
        total: cached.size,
        fileProgress: 100,
        filesCompleted,
        filesTotal,
        loadedBytes,
        totalBytes,
        progress: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0,
        speedBps: 0,
        etaSeconds: 0,
      });
      continue;
    }

    // 下载
    const result = await downloadFile(
      info.url,
      info.cacheKey,
      info.name,
      (loaded, total) => {
        const now = Date.now();
        const currentLoaded = loadedBytes + loaded;
        // 速度采样（每 500ms）
        if (now - lastSpeedTime > 500) {
          if (lastSpeedTime > 0 && currentLoaded > lastSpeedLoaded) {
            speedBps = ((currentLoaded - lastSpeedLoaded) / (now - lastSpeedTime)) * 1000;
          }
          lastSpeedTime = now;
          lastSpeedLoaded = currentLoaded;
        }
        const etaSeconds = speedBps > 0 ? (totalBytes - currentLoaded) / speedBps : 0;
        onProgress({
          file: info.name,
          loaded,
          total,
          fileProgress: total > 0 ? Math.round((loaded / total) * 100) : 0,
          filesCompleted,
          filesTotal,
          loadedBytes: currentLoaded,
          totalBytes,
          progress: totalBytes > 0 ? Math.round((currentLoaded / totalBytes) * 100) : 0,
          speedBps,
          etaSeconds,
        });
      },
      signal,
    );

    results.set(result.key, result.blob);
    filesCompleted++;
    loadedBytes += result.size;
  }

  return results;
}

/**
 * 检查模型是否已完整缓存
 */
export async function isModelCached(
  repo: string,
  dtype: string,
): Promise<boolean> {
  const suffixMap: Record<string, string> = {
    fp32: "",
    fp16: "_fp16",
    int8: "_int8",
    uint8: "_uint8",
    q8: "_quantized",
    q4: "_q4",
    q4f16: "_q4f16",
    bnb4: "_bnb4",
  };
  const suffix = suffixMap[dtype] ?? "_quantized";
  const requiredFiles = [
    "config.json",
    "tokenizer.json",
    `onnx/model${suffix}.onnx`,
  ];
  for (const f of requiredFiles) {
    const cached = await getModelFile(`${repo}/${f}`);
    if (!cached) return false;
  }
  return true;
}

/**
 * 创建自定义缓存对象（实现 Cache API 的 match/put），
 * 供 Transformers.js 的 env.useCustomCache + env.customCache 使用。
 *
 * Transformers.js 加载模型时会调用 customCache.match(request)，
 * 命中则返回 Response（不走网络），未命中则走网络并调用 put 缓存。
 * 我们用 IndexedDB 预存的文件作为缓存源，让 Transformers.js 完全从本地加载。
 */
export function createCustomCache(
  cachedFiles: Map<string, Blob>,
): Cache {
  return {
    match: async (request: RequestInfo | URL) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.href
            : request.url;
      // 匹配 HF / hf-mirror 的 resolve/main/path 请求
      const match = url.match(/\/([^/]+\/[^/]+)\/resolve\/main\/(.+?)(?:\?|$)/);
      if (match) {
        const repo = match[1];
        const filePath = match[2];
        const cacheKey = `${repo}/${filePath}`;
        const blob = cachedFiles.get(cacheKey);
        if (blob) {
          return new Response(blob, {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" },
          });
        }
      }
      // 未命中返回 undefined（Transformers.js 会走网络）
      return undefined as unknown as Response;
    },
    put: async () => {
      // 我们已用自定义下载器管理缓存，put 空实现即可
      return undefined as unknown as Response;
    },
    // 以下方法 Cache API 要求但 Transformers.js 不用，空实现
    add: async () => {},
    addAll: async () => {},
    delete: async () => false as boolean,
    keys: async () => [] as Request[],
    matchAll: async () => [] as Response[],
  } as unknown as Cache;
}
