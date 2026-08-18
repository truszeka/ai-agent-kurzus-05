import { randomBytes } from 'node:crypto';
import {
  CASE_STATUS_LABELS,
  CaseIntakeSchema,
  CaseRecordSchema,
  toCustomerView,
  toModelIntake,
  type CaseIntake,
  type CaseRecommendation,
  type CaseRecord,
  type CaseStatus,
  type CustomerCaseView,
  type ReviewerDecision,
  type StatusChange,
} from './case-schema.js';
import { getCase, listCases, saveCase, updateCase } from './case-store.js';
import type { AdvisorRunner } from '../agents/advisor-agent/advisor-agent.js';

// case-service.ts — az ÜGY életútja egy helyen. A HTTP-réteg (apps/server) és a UI csak ezt hívja.
// Itt él a use case három kemény szabálya:
//   1. minden ügy EMBERI ellenőrzésre kerül, mielőtt az ügyfélhez jutna (kötelező kapu);
//   2. az ügyfél SOHA nem lát jóváhagyatlan ajánlatot (toCustomerView szűr);
//   3. a bizonytalanság nem hiba, hanem eszkaláció — okkal, a lakberendező elé.
//
// A recommendation-futtató (AdvisorRunner) INJEKTÁLHATÓ: éles futásban a runAdvisorAgent,
// tesztben egy stub — így a teljes flow LLM és adatbázis nélkül végigtesztelhető.

/** E fölött a biztonság alatt mindenképp eszkalálunk a lakberendezőhöz. */
export const MIN_CONFIDENCE = 0.5;
/** Egy manuálisan összeállított csomag becsült lakberendezői ideje (mérési terv). */
export const MANUAL_MINUTES_PER_CASE = 25;

function nowIso(): string {
  return new Date().toISOString();
}

/** Rövid, ügyfélnek diktálható azonosító, pl. PB-7QK3ZA. */
export function generateCaseId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  const code = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
  return `PB-${code}`;
}

function withStatus(
  record: CaseRecord,
  status: CaseStatus,
  note = '',
): CaseRecord {
  const change: StatusChange = { status, at: nowIso(), note };
  return {
    ...record,
    status,
    statusHistory: [...record.statusHistory, change],
  };
}

// --- 1. Beérkezés ---------------------------------------------------------------------------

/** Az űrlap beküldése. Validál (rendszer-határ), ügyazonosítót ad, és elmenti az ügyet. */
export async function submitCase(rawIntake: unknown): Promise<CaseRecord> {
  const parsed = CaseIntakeSchema.safeParse(rawIntake);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new CaseValidationError(
      `${issue?.path.join('.') ?? 'űrlap'}: ${issue?.message ?? 'hibás érték'}`,
    );
  }
  const intake: CaseIntake = parsed.data;
  const createdAt = nowIso();
  const record = CaseRecordSchema.parse({
    caseId: generateCaseId(),
    createdAt,
    status: 'beerkezett',
    statusHistory: [{ status: 'beerkezett', at: createdAt, note: '' }],
    intake,
  });
  return saveCase(record);
}

export class CaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseValidationError';
  }
}

// --- 2. Feldolgozás (agent) -----------------------------------------------------------------

/**
 * Az agent lefuttatása egy ügyre: `feldolgozas_alatt` → tervezet → `emberi_ellenorzesre_var`.
 * A státusz a végén MINDIG emberi ellenőrzés — ez a use case kötelező kapuja.
 */
export async function processCase(
  caseId: string,
  runRecommendation: AdvisorRunner,
): Promise<CaseRecord | null> {
  const started = await updateCase(caseId, (record) =>
    withStatus(record, 'feldolgozas_alatt'),
  );
  if (!started) {
    return null;
  }

  // A MODELL csak ezt kapja meg: se név, se e-mail (terv 8. pont).
  const modelIntake = toModelIntake(
    started.intake,
    started.reviewerNote || undefined,
  );
  const result = await runRecommendation(modelIntake);

  const checked = applyGuardrails(
    result.recommendation,
    started.intake.budgetHuf,
  );
  const escalationReason = result.escalationReason ?? checked.escalationReason;

  return updateCase(caseId, (record) => ({
    ...withStatus(
      record,
      'emberi_ellenorzesre_var',
      escalationReason
        ? `eszkaláció: ${escalationReason}`
        : 'ajánlattervezet elkészült',
    ),
    recommendation: checked.recommendation,
    agentSql: result.sqlQueries,
    sqlAttemptCount: result.sqlAttemptCount,
    sqlErrorCount: result.sqlErrorCount,
    escalationReason,
    draftReadyAt: nowIso(),
  }));
}

/**
 * Determinisztikus ellenőrzések az LLM kimenetén: büdzsé, üres csomag, alacsony biztonság.
 * A figyelmeztetések a lakberendezői nézetbe kerülnek (terv 3. pont).
 */
export function applyGuardrails(
  recommendation: CaseRecommendation | null,
  budgetHuf: number,
): {
  recommendation: CaseRecommendation | null;
  escalationReason: string | null;
} {
  if (!recommendation) {
    return { recommendation: null, escalationReason: null };
  }
  const warnings = [...recommendation.warnings];
  let escalationReason: string | null = null;

  if (recommendation.items.length === 0) {
    warnings.push('Az agent nem talált a feltételeknek megfelelő növényt.');
    escalationReason = 'Nincs a feltételeknek megfelelő növény a katalógusban.';
  }
  if (recommendation.totalPriceHuf > budgetHuf) {
    warnings.push(
      `A csomag összára (${recommendation.totalPriceHuf} Ft) meghaladja a költségkeretet (${budgetHuf} Ft).`,
    );
    escalationReason = escalationReason ?? 'A költségkeret nem tartható.';
  }
  if (recommendation.confidence < MIN_CONFIDENCE) {
    warnings.push(
      `Az agent bizonytalan (confidence: ${recommendation.confidence.toFixed(2)}).`,
    );
    escalationReason =
      escalationReason ?? 'Az agent bizonytalan az ajánlatban.';
  }
  return {
    recommendation: { ...recommendation, warnings },
    escalationReason,
  };
}

// --- 3. Emberi döntés -----------------------------------------------------------------------

export interface DecisionInput {
  decision: ReviewerDecision;
  /** A lakberendező megjegyzése (visszaküldésnél/elutasításnál ez megy az ügyfélhez is). */
  note?: string;
  /** Jóváhagyás előtti szerkesztés. Ha van, az ügy "ember által módosítottnak" számít. */
  editedRecommendation?: CaseRecommendation;
}

/**
 * A lakberendezői döntés. Jóváhagyásnál az ügy két lépésben zárul (jóváhagyva → ajánlat
 * elkészült), így az ügyfél idővonalán is látszik, hogy volt emberi ellenőrzés.
 */
export async function decideCase(
  caseId: string,
  input: DecisionInput,
): Promise<CaseRecord | null> {
  const record = await getCase(caseId);
  if (!record) {
    return null;
  }
  if (record.status !== 'emberi_ellenorzesre_var') {
    throw new CaseValidationError(
      `Ez az ügy most nem dönthető el (állapot: ${CASE_STATUS_LABELS[record.status]}).`,
    );
  }
  const note = input.note?.trim() ?? '';

  if (input.decision === 'reject') {
    return updateCase(caseId, (current) => ({
      ...withStatus(current, 'elutasitva', note),
      reviewerDecision: 'reject',
      reviewerNote: note,
      reviewedAt: nowIso(),
    }));
  }

  if (input.decision === 'revise') {
    if (note === '') {
      throw new CaseValidationError(
        'Visszaküldéshez írj megjegyzést az agentnek.',
      );
    }
    return updateCase(caseId, (current) => ({
      ...withStatus(current, 'modositasra_visszakuldve', note),
      reviewerDecision: 'revise',
      reviewerNote: note,
      reviewerModified: true,
      reviewedAt: nowIso(),
    }));
  }

  // approve — a jóváhagyás teszi láthatóvá az ajánlatot az ügyfélnek.
  if (!record.recommendation && !input.editedRecommendation) {
    throw new CaseValidationError(
      'Ajánlat nélküli ügyet nem lehet jóváhagyni.',
    );
  }
  const edited = input.editedRecommendation ?? null;
  return updateCase(caseId, (current) => {
    const approved = withStatus(current, 'jovahagyva', note);
    const published = withStatus(approved, 'ajanlat_elkeszult');
    return {
      ...published,
      recommendation: edited ?? current.recommendation,
      reviewerDecision: 'approve',
      reviewerNote: note,
      reviewerModified: current.reviewerModified || edited !== null,
      reviewedAt: nowIso(),
    };
  });
}

// --- 4. Nézetek -----------------------------------------------------------------------------

/** Az ÜGYFÉL nézete — jóváhagyás nélkül soha nincs benne ajánlat. */
export async function getCustomerView(
  caseId: string,
): Promise<CustomerCaseView | null> {
  const record = await getCase(caseId);
  return record ? toCustomerView(record) : null;
}

/** A LAKBERENDEZŐ nézete: a teljes rekord (eredeti kérés, SQL, tervezet, indoklás). */
export async function getReviewCase(
  caseId: string,
): Promise<CaseRecord | null> {
  return getCase(caseId);
}

export async function listReviewCases(
  status?: CaseStatus,
): Promise<CaseRecord[]> {
  return listCases(status);
}

// --- 5. Mérési terv -------------------------------------------------------------------------

export interface CaseMetrics {
  totalCases: number;
  draftedCases: number;
  approvedCases: number;
  rejectedCases: number;
  /** Ajánlattervezet elkészítési ideje (másodperc, átlag). */
  avgDraftSeconds: number | null;
  /** Jóváhagyásig eltelt idő (másodperc, átlag). */
  avgApprovalSeconds: number | null;
  /** Emberi módosítás nélkül jóváhagyott ajánlatok aránya. */
  approvedWithoutEditRatio: number | null;
  escalationRatio: number | null;
  /** Hibás vagy sikertelen SQL-lekérdezések aránya. */
  sqlErrorRatio: number | null;
  withinBudgetRatio: number | null;
  /** Becsült megtakarított lakberendezői idő (perc). */
  savedReviewerMinutes: number;
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function secondsBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 1000;
}

export async function computeMetrics(): Promise<CaseMetrics> {
  const records = await listCases();
  const drafted = records.filter((record) => record.draftReadyAt !== null);
  const approved = records.filter(
    (record) => record.reviewerDecision === 'approve',
  );
  const rejected = records.filter(
    (record) => record.reviewerDecision === 'reject',
  );

  const draftSeconds = drafted.map((record) =>
    secondsBetween(record.createdAt, record.draftReadyAt as string),
  );
  const approvalSeconds = approved
    .filter((record) => record.reviewedAt !== null)
    .map((record) =>
      secondsBetween(record.createdAt, record.reviewedAt as string),
    );

  const sqlAttempts = records.reduce(
    (sum, record) => sum + record.sqlAttemptCount,
    0,
  );
  const sqlErrors = records.reduce(
    (sum, record) => sum + record.sqlErrorCount,
    0,
  );

  const withRecommendation = records.filter(
    (record) => record.recommendation !== null,
  );
  const withinBudget = withRecommendation.filter(
    (record) =>
      (record.recommendation as CaseRecommendation).totalPriceHuf <=
      record.intake.budgetHuf,
  );

  return {
    totalCases: records.length,
    draftedCases: drafted.length,
    approvedCases: approved.length,
    rejectedCases: rejected.length,
    avgDraftSeconds: average(draftSeconds),
    avgApprovalSeconds: average(approvalSeconds),
    approvedWithoutEditRatio: ratio(
      approved.filter((record) => !record.reviewerModified).length,
      approved.length,
    ),
    escalationRatio: ratio(
      records.filter((record) => record.escalationReason !== null).length,
      records.length,
    ),
    sqlErrorRatio: ratio(sqlErrors, sqlAttempts),
    withinBudgetRatio: ratio(withinBudget.length, withRecommendation.length),
    savedReviewerMinutes: approved.length * MANUAL_MINUTES_PER_CASE,
  };
}
