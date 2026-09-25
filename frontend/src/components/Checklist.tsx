import { useState } from 'react';

interface Props {
  items: string[];
}

export function Checklist({ items }: Props) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const doneCount = Object.values(checked).filter(Boolean).length;

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Reproducibility Checklist
        </h2>
        <span className="text-xs text-gray-400">
          {doneCount}/{items.length} done
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <label
            key={i}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span
              className={`text-sm leading-snug transition-colors ${
                checked[i]
                  ? 'text-gray-400 line-through'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}
            >
              {item}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
