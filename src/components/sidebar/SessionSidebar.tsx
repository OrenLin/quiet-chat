// 会话侧栏：列表、新建、重命名、删除；xAI 风格 —— 无填充、hairline 边框
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, MessageSquare } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface SessionSidebarProps {
  onNavigate?: () => void; // 移动端选中后关闭抽屉
}

export function SessionSidebar({ onNavigate }: SessionSidebarProps) {
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const selectSession = useStore((s) => s.selectSession);
  const deleteSession = useStore((s) => s.deleteSession);
  const renameSession = useStore((s) => s.renameSession);
  const newChat = useStore((s) => s.newChat);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleSelect = async (id: string) => {
    await selectSession(id);
    onNavigate?.();
  };

  const handleNew = async () => {
    newChat();
    onNavigate?.();
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditText(title);
  };

  const commitEdit = async () => {
    if (editingId && editText.trim()) {
      await renameSession(editingId, editText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-void border-r border-graphite">
      {/* 顶部：Logo + 新建 */}
      <div className="p-4 border-b border-graphite">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-sm text-stellar" style={{ letterSpacing: "0.1em" }}>
            QUIET
          </span>
          <span className="eyebrow">DEEPSEEK</span>
        </div>
        <button
          onClick={handleNew}
          className="w-full inline-flex items-center justify-center gap-2 rounded-pill border border-stellar px-4 py-2 text-sm text-stellar hover:bg-stellar/5 transition"
          style={{ letterSpacing: "-0.025em" }}
        >
          <Plus size={14} strokeWidth={1.5} />
          新对话
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ? (
          <p className="text-center text-2xs text-ash mt-8 px-4 font-mono" style={{ letterSpacing: "0.1em" }}>
            NO CONVERSATIONS
          </p>
        ) : (
          <div className="space-y-px">
            {sessions.map((s) => {
              const active = s.id === currentSessionId;
              const editing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative flex items-center gap-2 px-2.5 py-2 cursor-pointer transition",
                    active
                      ? "bg-stellar/5 border-l border-stellar"
                      : "border-l border-transparent hover:bg-stellar/3",
                  )}
                  onClick={() => !editing && handleSelect(s.id)}
                >
                  <MessageSquare size={12} className={cn("shrink-0", active ? "text-stellar" : "text-ash")} strokeWidth={1.5} />

                  {editing ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-transparent text-sm text-stellar focus:outline-none border-b border-stellar"
                      style={{ letterSpacing: "-0.025em" }}
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 min-w-0 truncate text-sm",
                        active ? "text-stellar" : "text-ash",
                      )}
                      style={{ letterSpacing: "-0.025em" }}
                    >
                      {s.title}
                    </span>
                  )}

                  {editing ? (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          commitEdit();
                        }}
                        className="p-1 text-stellar hover:bg-stellar/10 rounded"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="p-1 text-ash hover:text-stellar rounded"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(s.id, s.title);
                        }}
                        className="p-1 text-ash hover:text-stellar rounded"
                        title="重命名"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`删除会话「${s.title}」？`)) {
                            deleteSession(s.id);
                          }
                        }}
                        className="p-1 text-ash hover:text-danger rounded"
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部：地平线辉光 */}
      <div className="horizon-glow h-16 border-t border-graphite flex items-end justify-center pb-3">
        <span className="eyebrow relative z-10">QUIET · LOCAL FIRST</span>
      </div>
    </div>
  );
}
