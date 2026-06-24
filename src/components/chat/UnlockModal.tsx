// 解锁模态框：输入加密密码以解锁本地保存的 API Key
import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/useStore";

interface UnlockModalProps {
  onClose: () => void;
}

export function UnlockModal({ onClose }: UnlockModalProps) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const unlockKey = useStore((s) => s.unlockKey);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    const ok = await unlockKey(password);
    setLoading(false);
    if (ok) {
      onClose();
    } else {
      setError("密码错误，请重试");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <form
        onSubmit={submit}
        className="w-full max-w-sm card p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-cloud/10 border border-cloud/30 flex items-center justify-center mb-3">
            <Lock className="text-cloud" size={22} />
          </div>
          <h2 className="font-display text-lg font-semibold">解锁 API Key</h2>
          <p className="text-xs text-content-muted mt-1">
            输入加密密码以解密本地保存的 DeepSeek Key
          </p>
        </div>

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            placeholder="加密密码"
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-faint hover:text-content"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-danger mt-2 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={!password || loading}
          className="btn-primary w-full mt-4 justify-center"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <ShieldCheck size={15} /> 解锁
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="btn-ghost w-full mt-2 justify-center"
        >
          取消
        </button>
      </form>
    </div>
  );
}
