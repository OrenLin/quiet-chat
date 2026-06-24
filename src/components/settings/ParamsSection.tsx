// 推理参数区：温度、最大 Token、Top-P；xAI 风格
import { useStore } from "@/store/useStore";

export function ParamsSection() {
  const temperature = useStore((s) => s.settings.temperature);
  const maxTokens = useStore((s) => s.settings.maxTokens);
  const topP = useStore((s) => s.settings.topP);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <section>
      <div className="mb-4">
        <span className="eyebrow">[ PARAMETERS ]</span>
      </div>

      <div className="space-y-8">
        <Slider
          label="TEMPERATURE"
          hint="越高越随机创意，越低越确定"
          value={temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => updateSettings({ temperature: v })}
        />
        <Slider
          label="TOP-P"
          hint="核采样阈值"
          value={topP}
          min={0.1}
          max={1}
          step={0.05}
          onChange={(v) => updateSettings({ topP: v })}
        />
        <Slider
          label="MAX TOKENS"
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
      <div className="flex items-center justify-between mb-3">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-sm text-stellar" style={{ letterSpacing: "0.05em" }}>
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
        className="w-full h-px cursor-pointer appearance-none bg-graphite accent-stellar"
        style={{ height: "1px" }}
      />
      <p className="text-2xs text-ash mt-2" style={{ letterSpacing: "-0.3px" }}>{hint}</p>
    </div>
  );
}
