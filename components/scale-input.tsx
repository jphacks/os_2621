// 1〜5のスライダー（P2・ルーム後の振り返りで共通）
export function ScaleInput({
  id,
  label,
  value,
  onChange,
  scale,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  scale: readonly string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {value}／5 {scale[value - 1]}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[hsl(var(--primary))]"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{scale[0]}</span>
        <span>{scale[4]}</span>
      </div>
    </div>
  );
}
