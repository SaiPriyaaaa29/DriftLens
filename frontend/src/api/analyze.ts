import type { AnalysisResult } from '../types/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls POST /api/analyze with the given repository path.
 * Throws ApiError for non-200 responses.
 */
export async function analyzeRepo(repoPath: string): Promise<AnalysisResult> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

  const res = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? res.statusText
    );
  }

  return res.json() as Promise<AnalysisResult>;
}