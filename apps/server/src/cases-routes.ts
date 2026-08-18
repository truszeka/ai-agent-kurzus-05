import { Router } from 'express';
import {
  CaseRecommendationSchema,
  CaseValidationError,
  computeMetrics,
  decideCase,
  getCustomerView,
  getReviewCase,
  listReviewCases,
  processCase,
  runAdvisorAgent,
  submitCase,
  CASE_STATUSES,
  type CaseRecord,
  type CaseStatus,
  type ReviewerDecision,
} from '@plantbase/core';

// cases-routes.ts — az ÜGYFÉLOLDALI use case HTTP-bejárata. Vékony réteg: validál, hív, formáz.
// Minden üzleti szabály a core case-service-ében van (beleértve a kötelező emberi kaput).
//
// Két külön útvonal-csoport, mert két külön közönség:
//   /api/cases/*        — az ÜGYFÉL. Csak szűrt nézetet kap: jóváhagyatlan ajánlat sosem megy ki.
//   /api/review/*       — a LAKBERENDEZŐ. Teljes rekord: eredeti kérés, SQL, tervezet, indoklás.
// A PoC-ban a /review nincs autentikálva (hatókörön kívül) — éles rendszerben ide belépés kell.
//
// A feldolgozás ASZINKRON: a beküldés azonnal visszaadja az ügyazonosítót, az agent futása a
// háttérben megy. Így az ügyfél nem vár az LLM-re, és a státuszoldalon követheti az ügyet.

function isCaseStatus(value: unknown): value is CaseStatus {
  return (
    typeof value === 'string' &&
    (CASE_STATUSES as readonly string[]).includes(value)
  );
}

/** Háttérfeldolgozás: a hibát logoljuk, a kérés nem függ tőle. */
function startProcessing(caseId: string): void {
  void processCase(caseId, (intake) =>
    runAdvisorAgent(intake, { print: true }),
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`plantbase ügy-feldolgozás hiba (${caseId}): ${message}`);
  });
}

/** A lakberendezői nézet — a teljes rekord, ahogy a terv 3. pontja felsorolja. */
function toReviewView(record: CaseRecord) {
  return {
    caseId: record.caseId,
    createdAt: record.createdAt,
    status: record.status,
    statusHistory: record.statusHistory,
    intake: record.intake,
    recommendation: record.recommendation,
    agentSql: record.agentSql,
    sqlAttemptCount: record.sqlAttemptCount,
    sqlErrorCount: record.sqlErrorCount,
    escalationReason: record.escalationReason,
    draftReadyAt: record.draftReadyAt,
    reviewerDecision: record.reviewerDecision,
    reviewerNote: record.reviewerNote,
    reviewerModified: record.reviewerModified,
    reviewedAt: record.reviewedAt,
  };
}

export function casesRouter(): Router {
  const router = Router();

  // --- ÜGYFÉL ---------------------------------------------------------------------------

  // Igényfelmérő beküldése → ügyazonosító. Az agent a háttérben indul.
  router.post('/api/cases', async (req, res) => {
    try {
      const record = await submitCase(req.body);
      startProcessing(record.caseId);
      res.status(201).json({ caseId: record.caseId, status: record.status });
    } catch (error: unknown) {
      if (error instanceof CaseValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`plantbase ügy-beküldés hiba: ${message}`);
      res.status(500).json({ error: 'Az ügyet nem sikerült rögzíteni.' });
    }
  });

  // Státuszoldal: állapot + (csak jóváhagyás után) az ajánlat.
  router.get('/api/cases/:caseId', async (req, res) => {
    const view = await getCustomerView(req.params.caseId);
    if (!view) {
      res.status(404).json({ error: 'Nincs ilyen ügyazonosító.' });
      return;
    }
    res.json(view);
  });

  // --- LAKBERENDEZŐ ---------------------------------------------------------------------

  router.get('/api/review/metrics', async (_req, res) => {
    res.json(await computeMetrics());
  });

  router.get('/api/review/cases', async (req, res) => {
    const status = req.query['status'];
    if (status !== undefined && !isCaseStatus(status)) {
      res.status(400).json({ error: 'Ismeretlen állapot-szűrő.' });
      return;
    }
    const records = await listReviewCases(status);
    res.json(records.map(toReviewView));
  });

  router.get('/api/review/cases/:caseId', async (req, res) => {
    const record = await getReviewCase(req.params.caseId);
    if (!record) {
      res.status(404).json({ error: 'Nincs ilyen ügyazonosító.' });
      return;
    }
    res.json(toReviewView(record));
  });

  // Jóváhagyás / visszaküldés / elutasítás. Visszaküldésnél az agent újra fut a megjegyzéssel.
  router.post('/api/review/cases/:caseId/decision', async (req, res) => {
    const body: unknown = req.body;
    const decision = (body as { decision?: unknown })?.decision;
    if (
      decision !== 'approve' &&
      decision !== 'revise' &&
      decision !== 'reject'
    ) {
      res
        .status(400)
        .json({ error: 'A döntés csak approve, revise vagy reject lehet.' });
      return;
    }
    const noteRaw = (body as { note?: unknown })?.note;
    const note = typeof noteRaw === 'string' ? noteRaw : '';

    // A szerkesztett ajánlat is külső adat: Zod-validáció a határon.
    const editedRaw = (body as { recommendation?: unknown })?.recommendation;
    let editedRecommendation;
    if (editedRaw !== undefined && editedRaw !== null) {
      const parsed = CaseRecommendationSchema.safeParse(editedRaw);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'A szerkesztett ajánlat formátuma hibás.' });
        return;
      }
      editedRecommendation = parsed.data;
    }

    try {
      const updated = await decideCase(req.params.caseId, {
        decision: decision as ReviewerDecision,
        note,
        ...(editedRecommendation ? { editedRecommendation } : {}),
      });
      if (!updated) {
        res.status(404).json({ error: 'Nincs ilyen ügyazonosító.' });
        return;
      }
      // Visszaküldés → az agent újra nekifut, immár a lakberendező megjegyzésével.
      if (decision === 'revise') {
        startProcessing(updated.caseId);
      }
      res.json(toReviewView(updated));
    } catch (error: unknown) {
      if (error instanceof CaseValidationError) {
        res.status(409).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`plantbase döntés hiba: ${message}`);
      res.status(500).json({ error: 'A döntést nem sikerült rögzíteni.' });
    }
  });

  return router;
}
