// 空对话状态：xAI 风格 —— 大字 wordmark + 光晕 + 引导
import { ShieldCheck } from "lucide-react";
import { useStore } from "@/store/useStore";

const SUGGESTIONS = [
  "用三句话解释量子纠缠",
  "写一个快速排序的 Python 实现",
  "帮我润色一封求职邮件",
  "对比 REST 和 GraphQL 的优劣",
];

export function EmptyState() {
  const sendMessage = useStore((s) => s.sendMessage);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center hero-bloom">
      {/* Eyebrow */}
      <div className="relative z-10 mb-6">
        <span className="eyebrow">[ DEEPSEEK CHAT ]</span>
      </div>

      {/* Hero wordmark：发光大字 */}
      <h1
        className="relative z-10 text-stellar mb-3"
        style={{
          fontSize: "clamp(48px, 10vw, 80px)",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-2px",
          textShadow: "0 0 40px rgba(255,255,255,0.15)",
        }}
      >
        Quiet
      </h1>

      <p
        className="relative z-10 text-ash max-w-md mb-2"
        style={{ fontSize: "16px", letterSpacing: "-0.4px", lineHeight: 1.5 }}
      >
        深空中的对话 · DeepSeek 云端推理
      </p>
      <p className="relative z-10 text-ash max-w-md mb-8 flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck size={12} className="text-stellar" strokeWidth={1.5} />
        <span style={{ letterSpacing: "0.1em" }} className="font-mono">
          API KEY 本地加密 · 永不离开设备
        </span>
      </p>

      {/* 引导建议：ghost pill 风格 */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            className="text-left text-sm text-ash hover:text-stellar border border-graphite hover:border-smoke rounded-pill px-4 py-3 transition"
            style={{ letterSpacing: "-0.025em" }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
