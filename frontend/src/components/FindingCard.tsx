import { useState } from 'react';
import type { Finding } from '../types/api';

interface Props {
  finding: Finding;
}

const SEVERITY_STYLES: Record<Finding['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  info:     'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_BORDER: Record<Finding['severity'], string> = {
  critical: 'border-l-red-500',
  warning:  'border-l-yellow-400',
  info:     'border-l-blue-400',
};

export function FindingCard({ finding }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${SEVERITY_BORDER[finding.severity]} shadow-sm overflow-hidden`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
      >
        {/* Severity badge */}
        <span
          className={`mt-0.5 inline-block shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${SEVERITY_STYLES[finding.severity]}`}
        >
          {finding.severity}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{finding.title}</p>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">
            {finding.explanation}
          </p>
        </div>

        {/* Chevron */}
        <svg
          className={`shrink-0 mt-0.5 h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Expanded evidence */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Evidence
          </p>
          <div className="space-y-1.5">
            {finding.evidence.map((e, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 text-xs font-mono bg-gray-50 rounded px-3 py-1.5"
              >
                <span className="text-gray-500 shrink-0">{e.source}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700 break-all">{e.key}</span>
                {e.value !== '' && (
                  <>
                    <span className="text-gray-400">=</span>
                    <span className="text-blue-600 break-all">{e.value}</span>
                  </>
                )}
                {e.line !== undefined && (
                  <span className="ml-auto text-gray-400 shrink-0">L{e.line}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
