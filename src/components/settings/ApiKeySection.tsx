// API Key 加密管理区
import { useState } from "react";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { hasEncryptedKey } from "@/lib/settings";

export function ApiKeySection() {
  const settings = useStore((s) => s.settings);
  const isKeyUnlocked = useStore((s) => s.isKeyUnlocked);
  const saveApiKey = useStore((s) => s.saveApiKey);
  const clearApiKey = useStore((s) => s.clearApiKey);
  const unlockKey = useStore((s) => s.unlockKey);
  const lockKey = useStore((s) => s.lockKey);
  const testApiKey = useStore((s) => s.testApiKey);
  const updateSettings = useStore((s) => s.updateSettings);

  const hasKey = hasEncryptedKey(settings);

  // 新建/重置
  const [apiKey, setApiKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 解锁
  const [unlockPwd, setUnlockPwd] = useState("");
  const [unlockErr, setUnlockErr] = useState("");

  // 测试
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | boolean>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!apiKey.trim()) return setError("请输入 API Key");
    if (password.length < 6)
      return setError("密码至少 6 位");
    if (password !== confirmPwd) return setError("两次密码不一致");
    setSaving(true);
    await saveApiKey(apiKey.trim(), password);
    setSaving(false);
    setApiKey("");
    setPassword("");
    setConfirmPwd("");
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockErr("");
    const ok = await unlockKey(unlockPwd);
    if (!ok) setUnlockErr("密码错误");
    else setUnlockPwd("");
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testApiKey();
    setTestResult(ok);
    setTesting(false);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-cloud" />
        <h2 className="font-display font-semibold">DeepSeek API Key</h2>
        {hasKey && (
          <span
            className={`chip ml-auto ${isKeyUnlocked ? "bg-local/10 text-local" : "bg-white/5 text-content-faint"}`}
          >
            {isKeyUnlocked ? (
              <>
                <Unlock size={11} /> 已解锁
              </>
            ) : (
              <>
                <Lock size={11} /> 已加密
              </>
            )}
          </span>
        )}
      </div>
      <p className="text-xs text-content-muted mb-4">
        Key 使用 PBKDF2 + AES-GCM 在本地加密，密文存于 localStorage，明文永不离开设备。
      </p>

      {/* 云端模型名 */}
      <div className="mb-4">
        <label className="text-xs text-content-muted mb-1.5 block">
          云端模型 ID
        </label>
        <input
          type="text"
          value={settings.cloudModel}
          onChange={(e) => updateSettings({ cloudModel: e.target.value.trim() })}
          placeholder="deepseek-chat"
          className="input font-mono"
        />
        <p className="text-2xs text-content-faint mt-1">
          可填 deepseek-chat、deepseek-reasoner 或自定义模型名（如 deepseek-v4-pro）
        </p>
      </div>

      {/* 已保存但未解锁 */}
      {hasKey && !isKeyUnlocked && (
        <form onSubmit={handleUnlock} className="space-y-3">
          <div className="relative">
            <input
              type="password"
              value={unlockPwd}
              autoFocus
              onChange={(e) => setUnlockPwd(e.target.value)}
              placeholder="输入加密密码以解锁"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-faint hover:text-content"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {unlockErr && (
            <p className="text-xs text-danger">{unlockErr}</p>
          )}
          <button type="submit" className="btn-primary">
            <Unlock size={15} /> 解锁
          </button>
        </form>
      )}

      {/* 已解锁 */}
      {hasKey && isKeyUnlocked && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-ink-surface border border-ink-border">
            <CheckCircle2 size={15} className="text-local shrink-0" />
            <span className="font-mono text-sm text-content-muted truncate">
              {settings.cloudModel} · Key 已就绪
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="btn-outline"
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wifi size={14} />
              )}
              测试连通
            </button>
            <button onClick={lockKey} className="btn-ghost">
              <Lock size={14} /> 锁定
            </button>
            <button
              onClick={() => {
                if (confirm("确定清除已保存的 API Key？")) clearApiKey();
              }}
              className="btn-ghost text-danger hover:bg-danger/10"
            >
              <Trash2 size={14} /> 清除
            </button>
          </div>
          {testResult !== null && (
            <p
              className={`text-xs flex items-center gap-1.5 ${testResult ? "text-local" : "text-danger"}`}
            >
              {testResult ? (
                <CheckCircle2 size={13} />
              ) : (
                <XCircle size={13} />
              )}
              {testResult ? "连通正常，Key 有效" : "连接失败，请检查 Key 或网络"}
            </p>
          )}
        </div>
      )}

      {/* 未设置或重新设置 */}
      {!hasKey && (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-content-muted mb-1.5 block">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="input pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-faint hover:text-content"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-content-muted mb-1.5 block">
                加密密码
              </label>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-content-muted mb-1.5 block">
                确认密码
              </label>
              <input
                type={showPwd ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="再次输入"
                className="input"
              />
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <ShieldCheck size={15} /> 加密保存
              </>
            )}
          </button>
          <p className="text-2xs text-content-faint">
            密码仅用于本地加解密，不会被保存或上传。遗忘密码将无法解密 Key。
          </p>
        </form>
      )}
    </section>
  );
}
