// 输入区：自适应高度、发送/中止切换、字数与模式提示
import { useRef, useState, useEffect } from "react";
import { Send, Square, Globe } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function ChatInput() {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = useStore((s) => s.isGenerating);
  const sendMessage = useStore((s) => s.sendMessage);
  const stopGeneration = useStore((s) => s.stopGeneration);
  const mode = useStore((s) => s.settings.mode);
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

  const blocked =
    mode === "deepseek" && needsKeySetup && !isKeyUnlocked;
  const charCount = text.length;

  return (
    <div className="px-3 sm:px-6 pb-[calc(0.75rem+var(--sab))] pt-2">
      <div className="max-w-3xl mx-auto">
        <div
          className={cn(
            "relative rounded-3xl border bg-ink-raised transition-all",
            isGenerating
              ? "border-cloud/40 shadow-glow"
              : "border-ink-border focus-within:border-cloud/50 focus-within:shadow-glow",
          )}
        >
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              blocked
                ? "请先在设置中配置并解锁 DeepSeek API Key…"
                : mode === "deepseek"
                  ? "给 DeepSeek 发消息…  (Enter 发送 / Shift+Enter 换行)"
                  : "给本地模型发消息…  (首次将下载模型)"
            }
            disabled={blocked}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-[15px] leading-relaxed text-content placeholder:text-content-faint focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 200 }}
          />

          {/* 底部工具栏 */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1.5">
              {mode === "deepseek" && (
                <button
                  onClick={() =>
                    updateSettings({ onlineSearch: !onlineSearch })
                  }
                  className={cn(
                    "chip border transition",
                    onlineSearch
                      ? "bg-cloud/15 text-cloud border-cloud/30"
                      : "bg-transparent text-content-faint border-ink-border hover:text-content",
                  )}
                  title="在线搜索"
                >
                  <Globe size={12} />
                  联网
                </button>
              )}
              <span className="chip bg-transparent text-content-faint border-0 px-1">
                {mode === "deepseek" ? "DeepSeek" : "本地"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {charCount > 0 && (
                <span className="font-mono text-2xs text-content-faint">
                  {charCount}
                </span>
              )}
              {isGenerating ? (
                <button
                  onClick={stopGeneration}
                  className="w-9 h-9 rounded-full bg-danger text-white flex items-center justify-center hover:brightness-110 transition shadow-soft"
                  title="停止生成"
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!text.trim() || blocked}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition shadow-soft",
                    text.trim() && !blocked
                      ? "bg-cloud text-black hover:brightness-110 shadow-glow"
                      : "bg-ink-border text-content-faint cursor-not-allowed",
                  )}
                  title="发送"
                >
                  <Send size={15} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-2xs text-content-faint mt-2">
          {mode === "local"
            ? "本地模型在浏览器内运行，离线可用 · 能力有限"
            : "云端模式 · API Key 本地加密"}
        </p>
      </div>
    </div>
  );
}
