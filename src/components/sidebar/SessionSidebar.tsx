// 会话侧栏：列表、新建、重命名、删除；移动端抽屉
import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Cloud,
  Cpu,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/types";

interface SessionSidebarProps {
  onNavigate?: () => void; // 移动端选中后关闭抽屉
}

export function SessionSidebar({ onNavigate }: SessionSidebarProps) {
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const selectSession = useStore((s) => s.selectSession);
  const createSession = useStore((s) => s.createSession);
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
    <div className="flex flex-col h-full bg-ink-surface border-r border-ink-border">
      {/* 新建按钮 */}
      <div className="p-3">
        <button
          onClick={handleNew}
          className="btn-primary w-full justify-center"
        >
          <Plus size={16} strokeWidth={2.2} />
          新对话
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="text-center text-xs text-content-faint mt-8 px-4">
            还没有对话，点击上方开始
          </p>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((s) => {
              const active = s.id === currentSessionId;
              const editing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition",
                    active
                      ? "bg-ink-raised border border-ink-border"
                      : "hover:bg-white/5 border border-transparent",
                  )}
                  onClick={() => !editing && handleSelect(s.id)}
                >
                  <ModeIcon mode={s.mode} active={active} />

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
                      className="flex-1 min-w-0 bg-transparent text-sm text-content focus:outline-none border-b border-cloud/50"
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 min-w-0 truncate text-sm",
                        active ? "text-content" : "text-content-muted",
                      )}
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
                        className="p-1 text-local hover:bg-white/5 rounded"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="p-1 text-content-faint hover:bg-white/5 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(s.id, s.title);
                        }}
                        className="p-1 text-content-faint hover:text-content rounded"
                        title="重命名"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`删除会话「${s.title}」？`)) {
                            deleteSession(s.id);
                          }
                        }}
                        className="p-1 text-content-faint hover:text-danger rounded"
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeIcon({ mode, active }: { mode: ChatMode; active: boolean }) {
  const Icon = mode === "deepseek" ? Cloud : Cpu;
  return (
    <span
      className={cn(
        "shrink-0 w-5 h-5 rounded-md flex items-center justify-center",
        mode === "deepseek"
          ? active
            ? "bg-cloud/15 text-cloud"
            : "bg-white/5 text-content-faint"
          : active
            ? "bg-local/15 text-local"
            : "bg-white/5 text-content-faint",
      )}
    >
      <Icon size={11} />
    </span>
  );
}
