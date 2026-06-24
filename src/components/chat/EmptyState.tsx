// 空对话状态：欢迎语 + 引导
import { Sparkles, Cloud, Cpu, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/useStore";

const SUGGESTIONS = [
  "用三句话解释量子纠缠",
  "写一个快速排序的 Python 实现",
  "帮我润色一封求职邮件",
  "对比 REST 和 GraphQL 的优劣",
];

export function EmptyState() {
  const mode = useStore((s) => s.settings.mode);
  const sendMessage = useStore((s) => s.sendMessage);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 blur-2xl opacity-40 bg-cloud-glow rounded-full" />
        <div className="relative w-16 h-16 rounded-4xl bg-ink-raised border border-ink-border flex items-center justify-center">
          <Sparkles className="text-cloud" size={28} strokeWidth={1.8} />
        </div>
      </div>

      <h1 className="font-display text-2xl font-semibold text-content mb-2">
        静识 · 本地优先的对话
      </h1>
      <p className="text-sm text-content-muted max-w-md mb-1">
        云端用 DeepSeek 获得最强能力，本地用浏览器内模型离线兜底。
      </p>
      <p className="text-xs text-content-faint max-w-md mb-7 flex items-center justify-center gap-1.5">
        <ShieldCheck size={12} className="text-local" />
        API Key 本地加密存储，永不离开你的设备
      </p>

      <div className="flex items-center gap-2 mb-6 text-xs">
        <span
          className={`chip ${mode === "deepseek" ? "bg-cloud/15 text-cloud" : "bg-white/5 text-content-faint"}`}
        >
          <Cloud size={11} /> 云端 DeepSeek
        </span>
        <span className="text-content-faint">·</span>
        <span
          className={`chip ${mode === "local" ? "bg-local/15 text-local" : "bg-white/5 text-content-faint"}`}
        >
          <Cpu size={11} /> 本地 Qwen
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            className="text-left text-sm text-content-muted hover:text-content bg-ink-raised/60 hover:bg-ink-raised border border-ink-border hover:border-ink-border rounded-xl px-4 py-3 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
