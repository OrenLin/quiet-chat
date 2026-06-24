// 解锁模态框：xAI 风格 —— 无填充卡片，hairline 边框
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-void border border-graphite p-8 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-10 h-10 border border-stellar flex items-center justify-center mb-4">
            <Lock className="text-stellar" size={18} strokeWidth={1.5} />
          </div>
          <span className="eyebrow mb-2">[ UNLOCK ]</span>
          <h2 className="text-stellar text-lg" style={{ letterSpacing: "-0.45px" }}>
            解锁 API Key
          </h2>
          <p className="text-ash text-xs mt-2" style={{ letterSpacing: "-0.3px" }}>
            输入加密密码以解密本地保存的 DeepSeek Key
          </p>
        </div>

        <div className="relative mb-3">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-stellar"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-danger text-xs mb-3 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={!password || loading}
          className="btn-primary w-full justify-center"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <ShieldCheck size={15} strokeWidth={1.5} /> 解锁
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
