// Token 用量徽章
import { Coins } from "lucide-react";
import type { TokenUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TokenBadgeProps {
  usage: TokenUsage | null;
  tokPerSec?: number;
  className?: string;
}

export function TokenBadge({ usage, tokPerSec, className }: TokenBadgeProps) {
  if (!usage && !tokPerSec) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {usage && (
        <span className="chip bg-white/5 text-content-muted">
          <Coins size={11} strokeWidth={2} />
          <span className="text-content">{usage.total}</span>
          <span className="text-content-faint">
            (↑{usage.prompt} ↓{usage.completion})
          </span>
        </span>
      )}
      {tokPerSec && tokPerSec > 0 && (
        <span className="chip bg-local/10 text-local">
          {tokPerSec.toFixed(1)} tok/s
        </span>
      )}
    </div>
  );
}
