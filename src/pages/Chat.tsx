// 对话主页：顶栏 + 侧栏（桌面常驻/移动抽屉）+ 消息流 + 输入区
import { useState, useEffect } from "react";
import { Menu, Settings as SettingsIcon, X, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SessionSidebar } from "@/components/sidebar/SessionSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ModeSwitcher } from "@/components/chat/ModeSwitcher";
import { LocalStatusBar } from "@/components/chat/LocalStatusBar";
import { UnlockModal } from "@/components/chat/UnlockModal";
import { Link } from "react-router-dom";

export default function Chat() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  const mode = useStore((s) => s.settings.mode);
  const isKeyUnlocked = useStore((s) => s.isKeyUnlocked);
  const needsKeySetup = useStore((s) => s.needsKeySetup);
  const isGenerating = useStore((s) => s.isGenerating);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sessions = useStore((s) => s.sessions);
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 云端模式且需要解锁时，提示解锁
  const needUnlock =
    mode === "deepseek" && needsKeySetup && !isKeyUnlocked && !showUnlock;

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-ink">
      {/* 桌面侧栏 */}
      <aside className="hidden md:flex w-[260px] shrink-0">
        <SessionSidebar />
      </aside>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-[280px] max-w-[80vw] animate-fade-up">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-10 top-3 text-content-muted hover:text-content"
            >
              <X size={22} />
            </button>
            <SessionSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header className="shrink-0 glass z-10">
          <div className="flex items-center gap-3 px-3 sm:px-6 h-14">
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden btn-ghost !p-2"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-ink-raised border border-ink-border flex items-center justify-center">
                <Sparkles size={14} className="text-cloud" />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="font-display font-semibold text-content truncate">
                {currentSession?.title ?? "静识"}
              </span>
            </div>

            <div className="flex-1" />

            <ModeSwitcher />

            {needUnlock && (
              <button
                onClick={() => setShowUnlock(true)}
                className="btn-outline !py-1.5 !px-3 text-xs"
              >
                🔒 解锁 Key
              </button>
            )}

            <Link
              to="/settings"
              className="btn-ghost !p-2"
              title="设置"
            >
              <SettingsIcon size={18} />
            </Link>
          </div>

          {/* 本地模型状态条 */}
          <div className="px-3 sm:px-6 pb-2">
            <LocalStatusBar />
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

      {/* 生成中遮罩提示（移动端） */}
      {isGenerating && (
        <div className="md:hidden fixed top-14 left-1/2 -translate-x-1/2 z-20">
          <span className="chip bg-cloud/15 text-cloud border border-cloud/30 shadow-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-cloud animate-pulse" />
            生成中…
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
        <div className="w-10 h-10 rounded-2xl border-2 border-ink-border border-t-cloud animate-spin-slow" />
        <p className="text-xs text-content-faint">加载中…</p>
      </div>
    </div>
  );
}
