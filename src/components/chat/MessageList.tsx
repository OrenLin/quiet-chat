// 消息列表：渲染会话消息，自动滚动到底部
import { useStore } from "@/store/useStore";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { ArrowDown } from "lucide-react";
import type { Message } from "@/lib/types";

// 稳定的空数组引用，避免 selector 每次返回新数组导致无限渲染
const EMPTY_MESSAGES: Message[] = [];

export function MessageList() {
  const currentSessionId = useStore((s) => s.currentSessionId);
  const messages = useStore((s) =>
    s.currentSessionId
      ? s.messagesBySession[s.currentSessionId] ?? EMPTY_MESSAGES
      : EMPTY_MESSAGES,
  );
  const isGenerating = useStore((s) => s.isGenerating);
  const streamingMessageId = useStore((s) => s.streamingMessageId);
  const regenerate = useStore((s) => s.regenerate);
  const tokenUsage = useStore((s) => s.tokenUsage);

  // 流式时跟随最新内容；新消息时也滚动
  const lastMsg = messages[messages.length - 1];
  const streamingContent =
    isGenerating && lastMsg?.id === streamingMessageId ? lastMsg.content : "";
  const { containerRef, atBottom, scrollToBottom } = useAutoScroll(
    messages.length + streamingContent,
  );

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isStreaming={isGenerating && m.id === streamingMessageId}
              isLast={i === messages.length - 1}
              onRegenerate={regenerate}
            />
          ))}
          <div className="h-4" />
        </div>
      </div>

      {/* 回到底部按钮 */}
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-pill border border-graphite bg-void/80 backdrop-blur flex items-center justify-center text-ash hover:text-stellar hover:border-smoke transition"
          title="回到底部"
        >
          <ArrowDown size={15} strokeWidth={1.5} />
        </button>
      )}

      {/* Token 用量 */}
      {tokenUsage && !isGenerating && (
        <div className="absolute bottom-4 right-4 hidden sm:block">
          <span className="inline-flex items-center rounded-pill border border-graphite bg-void/80 backdrop-blur px-2.5 py-1 text-2xs text-ash font-mono" style={{ letterSpacing: "0.1em" }}>
            {tokenUsage.total} TOKENS
          </span>
        </div>
      )}
    </div>
  );
}
