import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { AnalysisResult } from '../models/types';
import { scanRepository } from '../scanner/index';
import { detect } from '../detector/index';
import { generateRepairPlan } from '../ai/repair-plan';

const router = Router();

/**
 * POST /api/analyze
 *
 * Body: { repoPath: string }
 *
 * Runs the full analysis pipeline:
 *   scanner → detector (+ classifier) → AI repair plan
 *
 * Returns AnalysisResult on success.
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const { repoPath } = req.body as { repoPath?: string };

  // 400 — missing field
  if (!repoPath || typeof repoPath !== 'string' || repoPath.trim() === '') {
    res.status(400).json({ error: 'repoPath is required' });
    return;
  }

  const resolvedPath = path.resolve(repoPath.trim());

  // 422 — path does not exist or is not a directory
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      res.status(422).json({ error: 'Path does not exist or is not a directory' });
      return;
    }
  } catch {
    res.status(422).json({ error: 'Path does not exist or is not a directory' });
    return;
  }

  // Run analysis pipeline
  try {
    const { scannedFiles, facts } = await scanRepository(resolvedPath);
    const findings = detect(facts);
    const { repairPlan, checklist } = await generateRepairPlan(findings);

    const result: AnalysisResult = {
      repoPath: resolvedPath,
      scannedFiles,
      facts,
      findings,
      repairPlan,
      checklist,
      analysedAt: new Date().toISOString(),
    };

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Analysis failed: ${msg}` });
  }
});

export { router as analyzeRouter };
