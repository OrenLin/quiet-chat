// 设置页：API Key、本地模型、推理参数、关于
import { ArrowLeft, ShieldCheck, Github, Cpu, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { LocalModelSection } from "@/components/settings/LocalModelSection";
import { ParamsSection } from "@/components/settings/ParamsSection";
import { useStore } from "@/store/useStore";

export default function Settings() {
  const backend = useStore((s) => s.backend);
  const mode = useStore((s) => s.settings.mode);

  return (
    <div className="h-dvh w-full overflow-y-auto bg-ink">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-[calc(2rem+var(--sab))]">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="btn-ghost !p-2">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-xl font-semibold">设置</h1>
        </div>

        <div className="space-y-4">
          <ApiKeySection />
          <LocalModelSection />
          <ParamsSection />

          {/* 关于 */}
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-3">关于</h2>
            <div className="space-y-2.5 text-sm">
              <Row
                icon={<ShieldCheck size={14} className="text-local" />}
                label="隐私"
                value="Key 本地加密 · 对话仅存本机"
              />
              <Row
                icon={mode === "deepseek" ? <Cloud size={14} className="text-cloud" /> : <Cpu size={14} className="text-local" />}
                label="当前模式"
                value={mode === "deepseek" ? "云端 DeepSeek" : "本地模型"}
              />
              <Row
                icon={<Cpu size={14} className="text-content-muted" />}
                label="推理后端"
                value={
                  backend === "webgpu"
                    ? "WebGPU（GPU 加速）"
                    : backend === "wasm"
                      ? "WASM（CPU）"
                      : "检测中"
                }
              />
            </div>
            <div className="mt-4 pt-4 border-t border-ink-border text-xs text-content-faint space-y-1">
              <p>技术栈：React + Vite + Transformers.js 3 + Web Crypto API</p>
              <p className="flex items-center gap-1.5">
                <Github size={12} />
                本地模型来自 HuggingFace · 首次下载后离线可用
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <span className="text-content-muted w-20 shrink-0">{label}</span>
      <span className="text-content">{value}</span>
    </div>
  );
}
