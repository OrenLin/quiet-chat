// 本地模型管理区：下载、设为默认、存储占用
import { useEffect, useState } from "react";
import {
  Cpu,
  Star,
  Download,
  Check,
  Loader2,
  HardDrive,
  Zap,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { LOCAL_MODELS } from "@/lib/models";
import { estimateStorage } from "@/lib/db";
import { cn } from "@/lib/utils";

export function LocalModelSection() {
  const localModel = useStore((s) => s.settings.localModel);
  const updateSettings = useStore((s) => s.updateSettings);
  const localStatus = useStore((s) => s.localStatus);
  const localProgress = useStore((s) => s.localProgress);
  const preloadLocalModel = useStore((s) => s.preloadLocalModel);
  const setMode = useStore((s) => s.setMode);

  const [storage, setStorage] = useState({ usage: 0, quota: 0 });

  useEffect(() => {
    estimateStorage().then(setStorage);
  }, [localStatus]);

  const formatBytes = (b: number) => {
    if (b === 0) return "0";
    const gb = b / 1024 / 1024 / 1024;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(b / 1024 / 1024).toFixed(0)} MB`;
  };

  const handleDownload = async (modelId: string) => {
    updateSettings({ localModel: modelId });
    setMode("local");
    // 等待设置更新后预加载
    setTimeout(() => preloadLocalModel(), 0);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Cpu size={16} className="text-local" />
        <h2 className="font-display font-semibold">本地模型</h2>
        <span className="chip ml-auto bg-local/10 text-local">
          <Zap size={11} /> 浏览器内推理
        </span>
      </div>
      <p className="text-xs text-content-muted mb-4">
        Transformers.js 3 + ONNX，WebGPU 优先、WASM 降级。首次下载后离线可用，权重缓存于 IndexedDB。
      </p>

      <div className="space-y-2.5">
        {LOCAL_MODELS.map((m) => {
          const isDefault = localModel === m.id;
          const isActive = isDefault && localStatus !== "idle";
          return (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border p-3.5 transition",
                isDefault
                  ? "border-local/40 bg-local/5"
                  : "border-ink-border bg-ink-surface",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-content">{m.name}</span>
                    <span className="chip bg-white/5 text-content-muted">
                      {m.sizeLabel}
                    </span>
                    {m.recommended && (
                      <span className="chip bg-cloud/10 text-cloud">推荐</span>
                    )}
                    {isDefault && (
                      <span className="chip bg-local/15 text-local">
                        <Check size={11} /> 默认
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-content-muted mt-1">
                    {m.description}
                  </p>
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={10}
                        className={
                          i < m.quality
                            ? "text-cloud fill-cloud"
                            : "text-ink-border"
                        }
                      />
                    ))}
                    <span className="text-2xs text-content-faint ml-1 font-mono">
                      {m.dtype.toUpperCase()} · {m.repo}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {!isDefault && (
                    <button
                      onClick={() => updateSettings({ localModel: m.id })}
                      className="btn-outline !py-1.5 !px-3 text-xs"
                    >
                      设为默认
                    </button>
                  )}
                  {isDefault && localStatus === "idle" && (
                    <button
                      onClick={() => handleDownload(m.id)}
                      className="btn-primary !py-1.5 !px-3 text-xs"
                    >
                      <Download size={13} /> 下载
                    </button>
                  )}
                  {isActive && localStatus === "downloading" && (
                    <span className="chip bg-cloud/10 text-cloud">
                      <Loader2 size={12} className="animate-spin" />
                      {localProgress}%
                    </span>
                  )}
                  {isActive && localStatus === "loading" && (
                    <span className="chip bg-white/5 text-content-muted">
                      <Loader2 size={12} className="animate-spin" /> 加载中
                    </span>
                  )}
                  {isActive && localStatus === "ready" && (
                    <span className="chip bg-local/10 text-local">
                      <Check size={12} /> 就绪
                    </span>
                  )}
                </div>
              </div>

              {/* 下载进度条 */}
              {isActive && localStatus === "downloading" && (
                <div className="mt-2.5 h-1 rounded-full bg-ink-border overflow-hidden">
                  <div
                    className="h-full bg-cloud transition-all duration-300"
                    style={{ width: `${localProgress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 存储占用 */}
      <div className="mt-4 flex items-center gap-2 text-xs text-content-faint">
        <HardDrive size={13} />
        <span>
          已用 {formatBytes(storage.usage)}
          {storage.quota > 0 && ` / ${formatBytes(storage.quota)}`}
        </span>
      </div>
    </section>
  );
}
