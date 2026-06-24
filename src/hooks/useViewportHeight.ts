// 移动端视口 hook：监听软键盘弹起，适配 visualViewport
import { useEffect, useState } from "react";

export function useViewportHeight() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setViewportHeight(vv.height);
      // 视觉视口比布局视口小很多 => 键盘弹起
      setKeyboardOpen(vv.height < window.innerHeight - 100);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return { keyboardOpen, viewportHeight };
}
