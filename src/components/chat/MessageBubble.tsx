// 单条消息气泡：用户/助手区分，Markdown 渲染，流式光标，复制
import { useState } from "react";
import { Copy, Check, RotateCcw, User, AlertTriangle } from "lucide-react";
import type { Message } from "@/lib/types";
import { Markdown } from "@/components/ui/Markdown";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  onRegenerate?: () => void;
  isLast: boolean;
}

export function MessageBubble({
  message,
  isStreaming,
  onRegenerate,
  isLast,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  // 本地模型"思考中"提示文字（预热/生成中）
  const localMessage = useStore((s) => s.localMessage);
  const localStatus = useStore((s) => s.localStatus);
  const mode = useStore((s) => s.settings.mode);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // 流式且内容为空时，本地模式显示 localMessage 作为思考状态
  const thinkingText =
    isStreaming && !message.content && mode === "local" && localStatus === "loading"
      ? localMessage || "正在思考…"
      : null;

  return (
    <div className="group animate-fade-up px-1">
      <div
        className={cn(
          "flex gap-3 sm:gap-4",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        {/* 头像 */}
        <div
          className={cn(
            "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border mt-0.5",
            isUser
              ? "bg-cloud/10 border-cloud/30 text-cloud"
              : message.error
                ? "bg-danger/10 border-danger/30 text-danger"
                : "bg-ink-raised border-ink-border text-local",
          )}
        >
          {isUser ? (
            <User size={15} strokeWidth={2} />
          ) : message.error ? (
            <AlertTriangle size={15} strokeWidth={2} />
          ) : (
            <Spark size={15} strokeWidth={2} />
          )}
        </div>

        {/* 内容 */}
        <div
          className={cn(
            "min-w-0 flex-1 max-w-[calc(100%-3rem)]",
            isUser ? "flex flex-col items-end" : "flex flex-col items-start",
          )}
        >
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              isUser
                ? "bg-cloud/8 border border-cloud/20 text-content"
                : message.error
                  ? "bg-danger/8 border border-danger/20"
                  : "bg-ink-raised border border-ink-border",
            )}
          >
            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            ) : message.content ? (
              <div className={isStreaming ? "stream-cursor" : ""}>
                <Markdown content={message.content} />
              </div>
            ) : (
              <ThinkingDots text={thinkingText} />
            )}
          </div>

          {/* 操作栏 */}
          {!isStreaming && message.content && !message.error && (
            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={copy}
                className="btn-ghost !px-2 !py-1 text-2xs text-content-faint hover:text-content"
                title="复制"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "已复制" : "复制"}
              </button>
              {!isUser && isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="btn-ghost !px-2 !py-1 text-2xs text-content-faint hover:text-content"
                  title="重新生成"
                >
                  <RotateCcw size={12} />
                  重新生成
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spark({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function ThinkingDots({ text }: { text: string | null }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-content-faint animate-pulse"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "1s" }}
          />
        ))}
      </div>
      {text && (
        <span className="text-xs text-content-faint animate-pulse">{text}</span>
      )}
    </div>
  );
}
