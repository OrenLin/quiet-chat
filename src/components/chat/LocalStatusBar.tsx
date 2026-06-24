// 本地模型状态条：详细下载进度、速度、ETA、镜像源切换
import {
  Cpu,
  Zap,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  WifiOff,
  Server,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getModelById } from "@/lib/models";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const mb = b / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return "—";
  const mbps = bps / 1024 / 1024;
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

function formatETA(sec: number): string {
  if (sec <= 0 || !isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m} 分 ${s} 秒`;
}

export function LocalStatusBar() {
  const mode = useStore((s) => s.settings.mode);
  const localModel = useStore((s) => s.settings.localModel);
  const modelMirror = useStore((s) => s.settings.modelMirror);
  const updateSettings = useStore((s) => s.updateSettings);
  const status = useStore((s) => s.localStatus);
  const progress = useStore((s) => s.localProgress);
  const message = useStore((s) => s.localMessage);
  const backend = useStore((s) => s.backend);
  const tokPerSec = useStore((s) => s.tokPerSec);
  const preloadLocalModel = useStore((s) => s.preloadLocalModel);
  const online = useOnlineStatus();

  const currentFile = useStore((s) => s.currentFile);
  const fileProgress = useStore((s) => s.fileProgress);
  const filesCompleted = useStore((s) => s.filesCompleted);
  const filesTotal = useStore((s) => s.filesTotal);
  const loadedBytes = useStore((s) => s.loadedBytes);
  const totalBytes = useStore((s) => s.totalBytes);
  const speedBps = useStore((s) => s.speedBps);
  const etaSeconds = useStore((s) => s.etaSeconds);

  if (mode !== "local") return null;
  const config = getModelById(localModel);

  const backendLabel =
    backend === "webgpu" ? "WebGPU" : backend === "wasm" ? "WASM" : "检测中";

  const isBusy = status === "downloading" || status === "loading";
  const needDownload = status === "idle";
  const offlineBlocked = needDownload && !online;
  const isDownloading = status === "downloading";

  const mirrorLabel =
    modelMirror === "hf-mirror"
      ? "国内镜像"
      : modelMirror === "hf"
        ? "官方源"
        : "自动";

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-ink-surface border border-ink-border text-xs">
      {/* 第一行：后端 + 模型 + 镜像 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "chip shrink-0",
            backend === "webgpu"
              ? "bg-local/10 text-local"
              : "bg-white/5 text-content-muted",
          )}
        >
          {backend === "webgpu" ? <Zap size={11} /> : <Cpu size={11} />}
          {backendLabel}
        </span>
        <span className="font-mono text-content-muted shrink-0">{config.name}</span>
        <span className="chip bg-white/5 text-content-faint shrink-0">
          <Server size={10} />
          {mirrorLabel}
        </span>
        <div className="flex-1" />
        {status === "ready" && tokPerSec > 0 && (
          <span className="chip bg-local/10 text-local">
            <Gauge size={11} />
            {tokPerSec.toFixed(1)} tok/s
          </span>
        )}
      </div>

      {/* 下载中：详细进度 */}
      {isDownloading && (
        <div className="space-y-1.5">
          {/* 总进度条 */}
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-cloud shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-ink-border overflow-hidden">
              <div
                className="h-full bg-cloud transition-all duration-300 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 shimmer" />
              </div>
            </div>
            <span className="font-mono text-cloud font-semibold shrink-0 w-9 text-right">
              {progress}%
            </span>
          </div>

          {/* 当前文件 + 文件进度 */}
          {currentFile && (
            <div className="flex items-center gap-2 text-content-faint">
              <FileDown size={11} className="shrink-0" />
              <span className="font-mono truncate flex-1">{currentFile}</span>
              <span className="font-mono shrink-0">{fileProgress}%</span>
            </div>
          )}

          {/* 统计行：文件数 / 已下载 / 速度 / ETA */}
          <div className="flex items-center gap-3 flex-wrap font-mono text-2xs text-content-faint">
            {filesTotal > 0 && (
              <span>
                文件 {filesCompleted}/{filesTotal}
              </span>
            )}
            {totalBytes > 0 && (
              <span>
                {formatBytes(loadedBytes)} / {formatBytes(totalBytes)}
              </span>
            )}
            {speedBps > 0 && (
              <span className="text-cloud">{formatSpeed(speedBps)}</span>
            )}
            {etaSeconds > 0 && (
              <span>剩余 {formatETA(etaSeconds)}</span>
            )}
          </div>

          {/* 卡住提示 */}
          {message?.includes("较慢") && (
            <div className="flex items-center gap-1.5 text-cloud/80 bg-cloud/8 rounded-lg px-2 py-1">
              <AlertCircle size={11} />
              <span>下载较慢？切换到「国内镜像」可加速</span>
            </div>
          )}
        </div>
      )}

      {/* 加载中 */}
      {status === "loading" && (
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-local shrink-0" />
          <span className="text-content-muted">{message || "加载模型到内存…"}</span>
        </div>
      )}

      {/* 就绪 */}
      {status === "ready" && (
        <div className="flex items-center gap-1.5 text-local">
          <CheckCircle2 size={12} />
          <span>就绪 · 离线可用</span>
        </div>
      )}

      {/* 错误 */}
      {status === "error" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-1.5 text-danger">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{message}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => preloadLocalModel()}
              className="chip bg-cloud/15 text-cloud border border-cloud/30 hover:bg-cloud/25 transition shrink-0"
            >
              <RotateCcw size={11} />
              重试
            </button>
            <span className="text-content-faint text-2xs">
              引擎失败请切换网络；模型失败请切「国内镜像」后重试
            </span>
          </div>
        </div>
      )}

      {/* 首次引导 / 离线提示 */}
      {needDownload && (
        <div className="flex flex-col gap-2 pt-1">
          {offlineBlocked ? (
            <span className="flex items-center gap-1.5 text-danger">
              <WifiOff size={12} />
              当前离线，首次下载模型需联网，请连接网络后重试
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-content-faint flex-1">
                  首次需下载模型（约 {config.sizeLabel}），下载后离线可用
                </span>
                <button
                  onClick={() => preloadLocalModel()}
                  className="chip bg-cloud/15 text-cloud border border-cloud/30 hover:bg-cloud/25 transition shrink-0"
                >
                  <Download size={11} />
                  立即下载
                </button>
              </div>
              {/* 镜像源切换 */}
              <div className="flex items-center gap-1.5">
                <span className="text-content-faint">下载源：</span>
                {([
                  { v: "auto", l: "自动" },
                  { v: "hf-mirror", l: "国内镜像" },
                  { v: "hf", l: "官方" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => updateSettings({ modelMirror: opt.v })}
                    className={cn(
                      "chip border transition",
                      modelMirror === opt.v
                        ? opt.v === "hf-mirror"
                          ? "bg-local/15 text-local border-local/30"
                          : "bg-cloud/15 text-cloud border-cloud/30"
                        : "bg-transparent text-content-faint border-ink-border hover:text-content",
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
                <span className="text-content-faint text-2xs ml-1">
                  国内推荐「国内镜像」
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 下载中也可切换镜像（下次生效） */}
      {isDownloading && (
        <div className="flex items-center gap-1.5">
          <span className="text-content-faint text-2xs">下载源：</span>
          {([
            { v: "auto", l: "自动" },
            { v: "hf-mirror", l: "国内镜像" },
            { v: "hf", l: "官方" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => updateSettings({ modelMirror: opt.v })}
              disabled={modelMirror === opt.v}
              className={cn(
                "chip border transition text-2xs",
                modelMirror === opt.v
                  ? opt.v === "hf-mirror"
                    ? "bg-local/15 text-local border-local/30"
                    : "bg-cloud/15 text-cloud border-cloud/30"
                  : "bg-transparent text-content-faint border-ink-border hover:text-content",
              )}
            >
              {opt.l}
            </button>
          ))}
          <span className="text-content-faint text-2xs">
            切换后需重新下载
          </span>
        </div>
      )}
    </div>
  );
}
