// 输入区：xAI 风格 —— 24px 圆角，hairline 边框，focus 时 signal blue border + bone ring
// 自适应高度、发送/中止切换、联网开关
import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square, Globe } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function ChatInput() {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = useStore((s) => s.isGenerating);
  const sendMessage = useStore((s) => s.sendMessage);
  const stopGeneration = useStore((s) => s.stopGeneration);
  const onlineSearch = useStore((s) => s.settings.onlineSearch);
  const updateSettings = useStore((s) => s.updateSettings);
  const isKeyUnlocked = useStore((s) => s.isKeyUnlocked);
  const needsKeySetup = useStore((s) => s.needsKeySetup);

  // 自适应高度
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    if (isGenerating || !text.trim()) return;
    const t = text;
    setText("");
    sendMessage(t);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const blocked = needsKeySetup && !isKeyUnlocked;
  const charCount = text.length;

  return (
    <div className="px-3 sm:px-6 pb-[calc(0.75rem+var(--sab))] pt-2">
      <div className="max-w-3xl mx-auto">
        <div
          className={cn(
            "relative rounded-input border bg-void transition-all duration-200",
            focused
              ? "border-signal"
              : isGenerating
                ? "border-smoke"
                : "border-graphite",
          )}
          style={
            focused
              ? { boxShadow: "0 0 0 2px #71717a" }
              : undefined
          }
        >
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={1}
            placeholder={
              blocked
                ? "请先在设置中配置并解锁 DeepSeek API Key…"
                : "What do you want to know?"
            }
            disabled={blocked}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-12 text-[15px] leading-relaxed text-stellar placeholder:text-ash focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 200, letterSpacing: "-0.025em" }}
          />

          {/* 底部工具栏 */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateSettings({ onlineSearch: !onlineSearch })
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-2xs font-mono transition",
                  onlineSearch
                    ? "border-stellar text-stellar"
                    : "border-graphite text-ash hover:text-stellar hover:border-smoke",
                )}
                title="在线搜索"
              >
                <Globe size={11} />
                <span style={{ letterSpacing: "0.1em" }}>
                  {onlineSearch ? "ONLINE" : "OFFLINE"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {charCount > 0 && (
                <span className="font-mono text-2xs text-ash">{charCount}</span>
              )}
              {isGenerating ? (
                <button
                  onClick={stopGeneration}
                  className="w-8 h-8 rounded-pill border border-graphite flex items-center justify-center text-stellar hover:border-smoke transition"
                  title="停止生成"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!text.trim() || blocked}
                  className={cn(
                    "w-8 h-8 rounded-pill flex items-center justify-center transition border",
                    text.trim() && !blocked
                      ? "border-stellar text-stellar hover:bg-stellar/10"
                      : "border-graphite text-ash cursor-not-allowed",
                  )}
                  title="发送"
                >
                  <ArrowUp size={14} strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-2xs text-ash mt-2.5 font-mono" style={{ letterSpacing: "0.1em" }}>
          DEEPSEEK · API KEY 本地加密
        </p>
      </div>
    </div>
  );
}
