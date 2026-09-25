import { useState } from 'react';
import type { AnalysisResult, Severity } from './types/api';
import { analyzeRepo, ApiError } from './api/analyze';
import { RepoInput } from './components/RepoInput';
import { FindingsList } from './components/FindingsList';
import { RepairPlan } from './components/RepairPlan';
import { Checklist } from './components/Checklist';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult };

function countBySeverity(result: AnalysisResult, sev: Severity) {
  return result.findings.filter((f) => f.severity === sev).length;
}

export default function App() {
  const [state, setState] = useState<State>({ status: 'idle' });

  const handleAnalyze = async (path: string) => {
    setState({ status: 'loading' });
    try {
      const result = await analyzeRepo(path);
      setState({ status: 'done', result });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred.';
      setState({ status: 'error', message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">DriftLens</h1>
              <p className="text-xs text-gray-500 mt-0.5">Repository environment drift detector</p>
            </div>
          </div>
          <RepoInput
            onAnalyze={handleAnalyze}
            loading={state.status === 'loading'}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Error banner ── */}
        {state.status === 'error' && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Analysis failed</p>
              <p className="text-sm text-red-600 mt-0.5">{state.message}</p>
            </div>
          </div>
        )}

        {/* ── Idle state ── */}
        {state.status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
            <svg className="h-14 w-14 mb-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-base font-medium">Enter a repository path above to begin</p>
            <p className="text-sm mt-1">DriftLens will scan for environment configuration drift</p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {state.status === 'loading' && (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        )}

        {/* ── Results ── */}
        {state.status === 'done' && (() => {
          const { result } = state;
          const critical = countBySeverity(result, 'critical');
          const warning  = countBySeverity(result, 'warning');
          const info     = countBySeverity(result, 'info');

          return (
            <div>
              {/* Summary bar */}
              <div className="mb-6 bg-white rounded-lg border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-900">{result.scannedFiles.length}</span> files scanned
                </span>
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-900">{result.findings.length}</span> findings
                </span>
                {critical > 0 && (
                  <span className="text-red-600 font-semibold">{critical} critical</span>
                )}
                {warning > 0 && (
                  <span className="text-yellow-600 font-semibold">{warning} warning</span>
                )}
                {info > 0 && (
                  <span className="text-blue-600 font-semibold">{info} info</span>
                )}
                <span className="ml-auto text-xs text-gray-400 font-mono truncate max-w-xs" title={result.repoPath}>
                  {result.repoPath}
                </span>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left — Findings */}
                <div>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                    Findings
                  </h2>
                  <FindingsList findings={result.findings} />
                </div>

                {/* Right — Repair plan + Checklist */}
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <RepairPlan markdown={result.repairPlan} />
                  </div>
                  {result.checklist.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                      <Checklist items={result.checklist} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
