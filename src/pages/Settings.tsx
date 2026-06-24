// 设置页：API Key、推理参数、关于；xAI 风格
import { ArrowLeft, ShieldCheck, Github, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { ParamsSection } from "@/components/settings/ParamsSection";

export default function Settings() {
  return (
    <div className="h-dvh w-full overflow-y-auto bg-void">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-[calc(2rem+var(--sab))]">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-ash hover:text-stellar transition">
            <ArrowLeft size={18} />
          </Link>
          <span className="eyebrow">[ SETTINGS ]</span>
        </div>

        <div className="space-y-12">
          <ApiKeySection />
          <ParamsSection />

          {/* 关于 */}
          <section>
            <div className="mb-4">
              <span className="eyebrow">[ ABOUT ]</span>
            </div>
            <div className="space-y-3 text-sm">
              <Row
                icon={<ShieldCheck size={14} className="text-stellar" strokeWidth={1.5} />}
                label="隐私"
                value="Key 本地加密 · 对话仅存本机"
              />
              <Row
                icon={<Cloud size={14} className="text-stellar" strokeWidth={1.5} />}
                label="模式"
                value="云端 DeepSeek"
              />
            </div>
            <div className="mt-6 pt-6 border-t border-graphite text-2xs text-ash space-y-1.5 font-mono" style={{ letterSpacing: "0.05em" }}>
              <p>REACT · VITE · WEB CRYPTO API</p>
              <p className="flex items-center gap-1.5">
                <Github size={11} />
                DEEPSEEK CLOUD · API KEY 本地加密
              </p>
            </div>
          </section>
        </div>

        {/* 底部地平线辉光 */}
        <div className="horizon-glow h-32 mt-12 -mx-4 sm:-mx-6" />
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
    <div className="flex items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <span className="text-ash w-16 shrink-0 text-xs font-mono" style={{ letterSpacing: "0.1em" }}>
        {label.toUpperCase()}
      </span>
      <span className="text-stellar" style={{ letterSpacing: "-0.025em" }}>{value}</span>
    </div>
  );
}
