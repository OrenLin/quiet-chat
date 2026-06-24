// 自动滚动到底部 hook：流式输出时跟随，用户上滑时暂停
import { useEffect, useRef, useState } from "react";

export function useAutoScroll<T>(dep: T) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el && atBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [dep, atBottom]);

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setAtBottom(true);
    }
  };

  return { containerRef, atBottom, scrollToBottom };
}
