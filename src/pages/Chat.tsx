// 对话主页：顶栏 + 侧栏（桌面常驻/移动抽屉）+ 消息流 + 输入区
import { useState, useEffect } from "react";
import { Menu, Settings as SettingsIcon, X, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SessionSidebar } from "@/components/sidebar/SessionSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { UnlockModal } from "@/components/chat/UnlockModal";
import { Link } from "react-router-dom";

export default function Chat() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  const isKeyUnlocked = useStore((s) => s.isKeyUnlocked);
  const needsKeySetup = useStore((s) => s.needsKeySetup);
  const isGenerating = useStore((s) => s.isGenerating);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sessions = useStore((s) => s.sessions);
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const newChat = useStore((s) => s.newChat);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 需要解锁时，提示解锁
  const needUnlock = needsKeySetup && !isKeyUnlocked && !showUnlock;

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-void">
      {/* 桌面侧栏 */}
      <aside className="hidden md:flex w-[260px] shrink-0">
        <SessionSidebar />
      </aside>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-[280px] max-w-[80vw] animate-fade-up">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-10 top-3 text-ash hover:text-stellar"
            >
              <X size={22} />
            </button>
            <SessionSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶栏：透明、无边框 */}
        <header className="shrink-0 z-10 border-b border-graphite">
          <div className="flex items-center gap-3 px-3 sm:px-6 h-14">
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden text-ash hover:text-stellar transition"
            >
              <Menu size={18} />
            </button>

            {/* 移动端 Logo */}
            <div className="md:hidden flex items-center">
              <span className="font-mono text-sm text-stellar" style={{ letterSpacing: "0.1em" }}>
                QUIET
              </span>
            </div>

            {/* 桌面端会话标题 */}
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="text-sm text-stellar truncate" style={{ letterSpacing: "-0.025em" }}>
                {currentSession?.title ?? "新对话"}
              </span>
            </div>

            <div className="flex-1" />

            {/* 新对话 */}
            <button
              onClick={newChat}
              className="inline-flex items-center gap-1.5 rounded-pill border border-graphite px-3 py-1.5 text-2xs text-ash hover:text-stellar hover:border-smoke transition font-mono"
              title="新对话"
            >
              <Plus size={12} />
              <span style={{ letterSpacing: "0.1em" }}>NEW</span>
            </button>

            {needUnlock && (
              <button
                onClick={() => setShowUnlock(true)}
                className="inline-flex items-center gap-1.5 rounded-pill border border-stellar px-3 py-1.5 text-2xs text-stellar hover:bg-stellar/5 transition font-mono"
              >
                <span style={{ letterSpacing: "0.1em" }}>UNLOCK</span>
              </button>
            )}

            <Link
              to="/settings"
              className="text-ash hover:text-stellar transition"
              title="设置"
            >
              <SettingsIcon size={18} />
            </Link>
          </div>
        </header>

        {/* 消息流 */}
        <div className="flex-1 min-h-0">
          {hydrated ? <MessageList /> : <LoadingShell />}
        </div>

        {/* 输入区 */}
        <div className="shrink-0">
          <ChatInput />
        </div>
      </main>

      {/* 生成中提示（移动端） */}
      {isGenerating && (
        <div className="md:hidden fixed top-14 left-1/2 -translate-x-1/2 z-20">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-graphite bg-void/80 backdrop-blur px-3 py-1.5 text-2xs text-stellar font-mono">
            <span className="w-1 h-1 rounded-full bg-stellar animate-breathe" />
            <span style={{ letterSpacing: "0.1em" }}>GENERATING</span>
          </span>
        </div>
      )}

      {showUnlock && <UnlockModal onClose={() => setShowUnlock(false)} />}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border border-graphite border-t-stellar animate-spin-slow" />
        <p className="text-2xs text-ash font-mono" style={{ letterSpacing: "0.1em" }}>
          LOADING
        </p>
      </div>
    </div>
  );
}
