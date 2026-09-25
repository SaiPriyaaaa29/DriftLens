import { useState } from 'react';
import type { Finding, Severity } from '../types/api';
import { FindingCard } from './FindingCard';

interface Props {
  findings: Finding[];
}

type Filter = 'all' | Severity;

const TABS: { label: string; value: Filter }[] = [
  { label: 'All',      value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Warning',  value: 'warning' },
  { label: 'Info',     value: 'info' },
];

const TAB_ACTIVE: Record<Filter, string> = {
  all:      'bg-gray-900 text-white',
  critical: 'bg-red-600 text-white',
  warning:  'bg-yellow-500 text-white',
  info:     'bg-blue-600 text-white',
};

const TAB_COUNT_COLOR: Record<Severity, string> = {
  critical: 'text-red-600',
  warning:  'text-yellow-600',
  info:     'text-blue-600',
};

export function FindingsList({ findings }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts: Record<Severity, number> = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning:  findings.filter((f) => f.severity === 'warning').length,
    info:     findings.filter((f) => f.severity === 'info').length,
  };

  const visible =
    filter === 'all' ? findings : findings.filter((f) => f.severity === filter);

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">✓</div>
        <p className="text-lg font-semibold text-green-700">No drift detected</p>
        <p className="mt-1 text-sm text-gray-500">
          All scanned configuration sources are consistent.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {TABS.map(({ label, value }) => {
          const isActive = filter === value;
          const count = value === 'all' ? findings.length : counts[value as Severity];
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                isActive
                  ? `${TAB_ACTIVE[value]} border-transparent`
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1.5 ${isActive ? 'text-white/80' : (value !== 'all' ? TAB_COUNT_COLOR[value as Severity] : 'text-gray-500')}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Findings */}
      {visible.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No {filter} findings.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
