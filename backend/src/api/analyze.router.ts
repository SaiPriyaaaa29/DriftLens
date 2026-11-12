import { Router, type Request, type Response } from 'express';
import type { AnalysisResult } from '../models/types';
import { scanRepository } from '../scanner/index';
import { detect } from '../detector/index';
import { generateRepairPlan } from '../ai/repair-plan';
import {
  downloadPublicGitHubRepository,
  cleanupDownloadedRepository,
} from '../scanner/github-repository';

const router = Router();

/** Max analyses running at the same time (each one clones a repository). */
const MAX_CONCURRENT_ANALYSES =
  Number(process.env.MAX_CONCURRENT_ANALYSES) || 2;

let activeAnalyses = 0;

/**
 * POST /api/analyze
 *
 * Body: { repoUrl: string }
 *
 * Runs the full analysis pipeline:
 *   GitHub download → scanner → detector (+ classifier) → AI repair plan
 *
 * Returns AnalysisResult on success.
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const { repoUrl } = (req.body ?? {}) as { repoUrl?: string };

  // 400 — missing or empty GitHub URL
  if (!repoUrl || typeof repoUrl !== 'string' || repoUrl.trim() === '') {
    res.status(400).json({ error: 'repoUrl is required' });
    return;
  }

  // 503 — too many analyses already running
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    res.setHeader('Retry-After', '15');
    res
      .status(503)
      .json({ error: 'Server is busy analysing other repositories. Please try again shortly.' });
    return;
  }

  activeAnalyses += 1;

  try {
    // Download the public GitHub repository
    let downloaded: { repoPath: string; tempDir: string };

    try {
      downloaded = await downloadPublicGitHubRepository(repoUrl.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      const isInvalidUrl =
        msg.startsWith('Please enter') ||
        msg.startsWith('Only public') ||
        msg.startsWith('Invalid repository URL');

      res.status(isInvalidUrl ? 400 : 422).json({ error: msg });
      return;
    }

    try {
      // Run the existing analysis pipeline
      const { scannedFiles, facts } = await scanRepository(downloaded.repoPath);
      const findings = detect(facts);
      const { repairPlan, checklist } = await generateRepairPlan(findings);

      const result: AnalysisResult = {
        repoPath: repoUrl.trim(),
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
    } finally {
      // Always remove the temporary repository after analysis
      try {
        await cleanupDownloadedRepository(downloaded.tempDir);
      } catch {
        // Cleanup failure should not replace the analysis response
      }
    }
  } finally {
    // Release the slot on every path: success, download error or analysis error
    activeAnalyses -= 1;
  }
});

export { router as analyzeRouter };