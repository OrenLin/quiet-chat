// 模式切换：云端 DeepSeek / 本地模型
import { Cloud, Cpu } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/types";

export function ModeSwitcher() {
  const mode = useStore((s) => s.settings.mode);
  const setMode = useStore((s) => s.setMode);
  const isGenerating = useStore((s) => s.isGenerating);

  const options: { value: ChatMode; label: string; icon: typeof Cloud }[] = [
    { value: "deepseek", label: "云端", icon: Cloud },
    { value: "local", label: "本地", icon: Cpu },
  ];

  return (
    <div className="inline-flex items-center rounded-full bg-ink-raised border border-ink-border p-0.5">
      {options.map((opt) => {
        const active = mode === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            disabled={isGenerating}
            onClick={() => setMode(opt.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? opt.value === "deepseek"
                  ? "bg-cloud text-black shadow-glow"
                  : "bg-local text-black shadow-glow-local"
                : "text-content-muted hover:text-content",
              isGenerating && "opacity-60 cursor-not-allowed",
            )}
          >
            <Icon size={13} strokeWidth={2} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
