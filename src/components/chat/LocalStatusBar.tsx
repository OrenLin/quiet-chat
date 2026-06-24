// 本地模型状态条：后端类型、加载进度、推理速度、首次引导
import {
  Cpu,
  Zap,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  WifiOff,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getModelById } from "@/lib/models";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

export function LocalStatusBar() {
  const mode = useStore((s) => s.settings.mode);
  const localModel = useStore((s) => s.settings.localModel);
  const status = useStore((s) => s.localStatus);
  const progress = useStore((s) => s.localProgress);
  const message = useStore((s) => s.localMessage);
  const backend = useStore((s) => s.backend);
  const tokPerSec = useStore((s) => s.tokPerSec);
  const preloadLocalModel = useStore((s) => s.preloadLocalModel);
  const online = useOnlineStatus();

  if (mode !== "local") return null;
  const config = getModelById(localModel);

  const backendLabel =
    backend === "webgpu" ? "WebGPU 加速" : backend === "wasm" ? "WASM" : "检测中";

  const isBusy = status === "downloading" || status === "loading";
  const needDownload = status === "idle";
  const offlineBlocked = needDownload && !online;

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-ink-surface border border-ink-border text-xs">
      <div className="flex items-center gap-2.5">
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

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {isBusy && (
            <>
              <Loader2 size={12} className="animate-spin text-cloud shrink-0" />
              <div className="flex-1 h-1 rounded-full bg-ink-border overflow-hidden max-w-[180px]">
                <div
                  className="h-full bg-cloud transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono text-content-faint shrink-0">
                {progress}%
              </span>
            </>
          )}
          {status === "ready" && (
            <span className="flex items-center gap-1.5 text-local">
              <CheckCircle2 size={12} />
              就绪
              {tokPerSec > 0 && (
                <span className="flex items-center gap-1 text-content-muted ml-1">
                  <Gauge size={11} />
                  {tokPerSec.toFixed(1)} tok/s
                </span>
              )}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-danger">
              <AlertCircle size={12} />
              <span className="truncate">{message}</span>
            </span>
          )}
        </div>
      </div>

      {/* 首次引导 / 离线提示 */}
      {needDownload && (
        <div className="flex items-center gap-2 pt-1">
          {offlineBlocked ? (
            <span className="flex items-center gap-1.5 text-danger">
              <WifiOff size={12} />
              当前离线，首次下载模型需联网，请连接网络后重试
            </span>
          ) : (
            <>
              <span className="text-content-faint">
                首次需下载模型（约 {config.sizeLabel}），下载后离线可用
              </span>
              <button
                onClick={() => preloadLocalModel()}
                className="ml-auto chip bg-cloud/15 text-cloud border border-cloud/30 hover:bg-cloud/25 transition shrink-0"
              >
                <Download size={11} />
                立即下载
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
