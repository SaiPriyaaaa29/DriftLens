import { useEffect, useRef } from 'react';

interface Props {
  markdown: string;
}

const FALLBACK_PREFIX = 'AI repair plan unavailable';

/**
 * Renders the AI-generated repair plan markdown as formatted HTML.
 * Uses a simple regex-based renderer to avoid a heavy dependency.
 */
export function RepairPlan({ markdown }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Simple markdown → HTML conversion covering the subset the LLM returns
    const html = markdown
      // Headings
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-gray-800 mt-4 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm,  '<h2 class="text-base font-bold text-gray-900 mt-5 mb-1">$1</h2>')
      .replace(/^# (.+)$/gm,   '<h1 class="text-lg font-bold text-gray-900 mt-6 mb-2">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">$1</code>')
      // Numbered list items
      .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Bullet list items
      .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      // Blank lines → paragraph breaks
      .replace(/\n{2,}/g, '</p><p class="mb-2">');

    ref.current.innerHTML = `<p class="mb-2">${html}</p>`;
  }, [markdown]);

  const isFallback = markdown.startsWith(FALLBACK_PREFIX);

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
        AI Repair Plan
      </h2>
      {isFallback ? (
        <p className="text-sm text-gray-400 italic">{markdown}</p>
      ) : (
        <div
          ref={ref}
          className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed"
        />
      )}
    </div>
  );
}
