// 推理参数区：温度、最大 Token、Top-P
import { Thermometer, Hash, Percent } from "lucide-react";
import { useStore } from "@/store/useStore";

export function ParamsSection() {
  const temperature = useStore((s) => s.settings.temperature);
  const maxTokens = useStore((s) => s.settings.maxTokens);
  const topP = useStore((s) => s.settings.topP);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <section className="card p-5">
      <h2 className="font-display font-semibold mb-1">推理参数</h2>
      <p className="text-xs text-content-muted mb-4">
        云端与本地共用。本地模型受参数能力限制，效果可能不如云端。
      </p>

      <div className="space-y-5">
        <Slider
          icon={<Thermometer size={14} />}
          label="温度"
          hint="越高越随机创意，越低越确定"
          value={temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => updateSettings({ temperature: v })}
        />
        <Slider
          icon={<Percent size={14} />}
          label="Top-P"
          hint="核采样阈值"
          value={topP}
          min={0.1}
          max={1}
          step={0.05}
          onChange={(v) => updateSettings({ topP: v })}
        />
        <Slider
          icon={<Hash size={14} />}
          label="最大 Token"
          hint="单次回复上限"
          value={maxTokens}
          min={256}
          max={8192}
          step={256}
          onChange={(v) => updateSettings({ maxTokens: v })}
          integer
        />
      </div>
    </section>
  );
}

interface SliderProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  integer?: boolean;
}

function Slider({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  integer,
}: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-sm text-content">
          {icon}
          {label}
        </span>
        <span className="font-mono text-sm text-cloud">
          {integer ? value : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cloud h-1.5 cursor-pointer"
      />
      <p className="text-2xs text-content-faint mt-1">{hint}</p>
    </div>
  );
}
