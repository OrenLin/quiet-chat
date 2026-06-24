// 单条消息：用户/助手区分，Markdown 渲染，流式文字光效，复制
import { useState, useRef, useEffect, memo } from "react";
import { Copy, Check, RotateCcw, User, AlertTriangle } from "lucide-react";
import type { Message } from "@/lib/types";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  onRegenerate?: () => void;
  isLast: boolean;
}

function MessageBubbleBase({
  message,
  isStreaming,
  onRegenerate,
  isLast,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group animate-fade-up">
      <div className="flex gap-3 sm:gap-4">
        {/* 头像：极简方形，hairline 边框 */}
        <div
          className={cn(
            "shrink-0 w-7 h-7 flex items-center justify-center border mt-0.5",
            isUser
              ? "border-stellar text-stellar"
              : message.error
                ? "border-danger text-danger"
                : "border-graphite text-stellar",
          )}
        >
          {isUser ? (
            <User size={13} strokeWidth={1.5} />
          ) : message.error ? (
            <AlertTriangle size={13} strokeWidth={1.5} />
          ) : (
            <Spark size={13} strokeWidth={1.5} />
          )}
        </div>

        {/* 内容 */}
        <div className="min-w-0 flex-1 max-w-[calc(100%-2.75rem)]">
          {/* 角色标签：mono eyebrow */}
          <div className="mb-1.5">
            <span className="eyebrow">
              {isUser ? "[ YOU ]" : message.error ? "[ ERROR ]" : "[ GROK ]"}
            </span>
          </div>

          {/* 消息体：无气泡、无填充，仅排版 */}
          <div className="text-stellar">
            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            ) : message.content ? (
              isStreaming ? (
                <StreamingContent content={message.content} />
              ) : (
                <Markdown content={message.content} />
              )
            ) : (
              <ThinkingDots />
            )}
          </div>

          {/* 操作栏：ghost pill 风格 */}
          {!isStreaming && message.content && !message.error && (
            <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-pill border border-graphite px-2.5 py-1 text-2xs text-ash hover:text-stellar hover:border-smoke transition"
                title="复制"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                <span className="font-mono">{copied ? "COPIED" : "COPY"}</span>
              </button>
              {!isUser && isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-graphite px-2.5 py-1 text-2xs text-ash hover:text-stellar hover:border-smoke transition"
                  title="重新生成"
                >
                  <RotateCcw size={11} />
                  <span className="font-mono">RETRY</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

/**
 * 流式内容渲染：
 * - 已稳定部分用 Markdown 渲染
 * - 新增部分（自上次渲染后）包裹在 .token span 中，触发 token-glow 动画
 * - 末尾跟随发光脉冲光标
 * 这样每个新出现的文字片段都会"灵动地发光产生"。
 */
function StreamingContent({ content }: { content: string }) {
  const prevLenRef = useRef(0);

  const prevLen = prevLenRef.current;
  const stable = content.slice(0, prevLen);
  const live = content.slice(prevLen);

  useEffect(() => {
    prevLenRef.current = content.length;
  }, [content]);

  return (
    <div className="streaming">
      {stable && <Markdown content={stable} />}
      {live && <span className="token">{live}</span>}
      <span className="stream-cursor" />
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

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-stellar animate-breathe"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="eyebrow animate-breathe">THINKING</span>
    </div>
  );
}
