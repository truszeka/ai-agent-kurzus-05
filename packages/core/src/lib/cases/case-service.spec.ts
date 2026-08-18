import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CaseValidationError,
  computeMetrics,
  decideCase,
  getCustomerView,
  listReviewCases,
  processCase,
  submitCase,
} from './case-service.js';
import type { AdvisorResult } from '../agents/advisor-agent/advisor-agent.js';
import type { CaseRecommendation, ModelIntake } from './case-schema.js';

/** Tesztsegéd: a nem-null ajánlás kibontása non-null assertion nélkül. */
function mustRecommendation(
  value: CaseRecommendation | null | undefined,
): CaseRecommendation {
  if (!value) {
    throw new Error('A teszt ajánlást várt, de nem kapott.');
  }
  return value;
}

const INTAKE = {
  customerName: 'Kovács Anna',
  customerEmail: 'anna@example.com',
  roomType: 'hálószoba',
  light: 'alacsony',
  spaceDescription: 'két 30 cm-es polc az ágy mellett',
  stylePreference: 'letisztult, sötétzöld',
  budgetHuf: 20000,
  specialRequests: 'macskabarát legyen',
};

function goodResult(overrides: Partial<AdvisorResult> = {}): AdvisorResult {
  return {
    recommendation: {
      items: [
        {
          name: 'Kentia pálma',
          latinName: 'Howea forsteriana',
          priceHuf: 8990,
          reason: 'árnyéktűrő',
        },
        {
          name: 'Elefántláb',
          latinName: 'Beaucarnea recurvata',
          priceHuf: 6990,
          reason: 'ritka öntözés',
        },
      ],
      totalPriceHuf: 15980,
      reasoning: 'Két alacsony fényigényű, macskabarát növény a polcokra.',
      warnings: [],
      confidence: 0.88,
      escalationReason: null,
    },
    escalationReason: null,
    sqlQueries: ['SELECT * FROM products WHERE pet_safe = true LIMIT 20'],
    sqlAttemptCount: 1,
    sqlErrorCount: 0,
    rawAnswer: '{}',
    ...overrides,
  };
}

let dir: string;
let seenIntake: ModelIntake | null = null;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plantbase-service-'));
  process.env['CASES_FILE'] = join(dir, 'cases.json');
  seenIntake = null;
});

afterEach(async () => {
  delete process.env['CASES_FILE'];
  await rm(dir, { recursive: true, force: true });
});

const runner =
  (result: AdvisorResult = goodResult()) =>
  async (intake: ModelIntake): Promise<AdvisorResult> => {
    seenIntake = intake;
    return result;
  };

describe('submitCase', () => {
  it('should create a case with an id and Beérkezett status', async () => {
    const record = await submitCase(INTAKE);
    expect(record.caseId).toMatch(/^PB-[A-Z2-9]{6}$/);
    expect(record.status).toBe('beerkezett');
  });

  it('should reject an invalid intake', async () => {
    await expect(
      submitCase({ ...INTAKE, customerEmail: 'nem-email' }),
    ).rejects.toBeInstanceOf(CaseValidationError);
  });
});

describe('processCase', () => {
  it('should stop at human review even for a confident draft', async () => {
    const created = await submitCase(INTAKE);
    const processed = await processCase(created.caseId, runner());
    expect(processed?.status).toBe('emberi_ellenorzesre_var');
    expect(processed?.recommendation?.items).toHaveLength(2);
    expect(processed?.draftReadyAt).not.toBeNull();
  });

  it('should never send name or email to the model', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    const sent = JSON.stringify(seenIntake);
    expect(sent).not.toContain('Kovács Anna');
    expect(sent).not.toContain('anna@example.com');
    expect(sent).toContain('hálószoba');
  });

  it('should escalate when the package is over budget', async () => {
    const created = await submitCase(INTAKE);
    const overBudget = goodResult();
    const processed = await processCase(
      created.caseId,
      runner({
        ...overBudget,
        recommendation: {
          ...mustRecommendation(overBudget.recommendation),
          totalPriceHuf: 45000,
        },
      }),
    );
    expect(processed?.escalationReason).toContain('költségkeret');
    expect(processed?.recommendation?.warnings.join(' ')).toContain('45000');
  });

  it('should escalate when the agent is not confident', async () => {
    const created = await submitCase(INTAKE);
    const unsure = goodResult();
    const processed = await processCase(
      created.caseId,
      runner({
        ...unsure,
        recommendation: {
          ...mustRecommendation(unsure.recommendation),
          confidence: 0.2,
        },
      }),
    );
    expect(processed?.escalationReason).toContain('bizonytalan');
  });

  it('should escalate when the agent produced no recommendation', async () => {
    const created = await submitCase(INTAKE);
    const processed = await processCase(
      created.caseId,
      runner({
        ...goodResult(),
        recommendation: null,
        escalationReason: 'Nem tudtam megbízható SQL-lekérdezést készíteni.',
      }),
    );
    expect(processed?.status).toBe('emberi_ellenorzesre_var');
    expect(processed?.recommendation).toBeNull();
    expect(processed?.escalationReason).toContain('SQL');
  });

  it('should return null for an unknown case', async () => {
    expect(await processCase('PB-NINCS', runner())).toBeNull();
  });
});

describe('customer visibility', () => {
  it('should hide the recommendation before approval', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    const view = await getCustomerView(created.caseId);
    expect(view?.status).toBe('emberi_ellenorzesre_var');
    expect(view?.recommendation).toBeNull();
    expect(view?.message).toContain('ellenőrzi');
  });

  it('should show the recommendation after approval', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    await decideCase(created.caseId, { decision: 'approve' });
    const view = await getCustomerView(created.caseId);
    expect(view?.status).toBe('ajanlat_elkeszult');
    expect(view?.recommendation?.totalPriceHuf).toBe(15980);
    expect(view?.statusHistory.map((change) => change.status)).toContain(
      'jovahagyva',
    );
  });

  it('should return null for an unknown case id', async () => {
    expect(await getCustomerView('PB-NINCS')).toBeNull();
  });
});

describe('decideCase', () => {
  it('should mark the case modified when the reviewer edits the draft', async () => {
    const created = await submitCase(INTAKE);
    const processed = await processCase(created.caseId, runner());
    const edited = {
      ...mustRecommendation(processed?.recommendation),
      reasoning: 'Lakberendező által pontosítva.',
    };
    const decided = await decideCase(created.caseId, {
      decision: 'approve',
      editedRecommendation: edited,
    });
    expect(decided?.reviewerModified).toBe(true);
    expect(decided?.recommendation?.reasoning).toContain('pontosítva');
  });

  it('should send the case back for revision and allow a rerun', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    const sentBack = await decideCase(created.caseId, {
      decision: 'revise',
      note: 'Legyen olcsóbb és három növény.',
    });
    expect(sentBack?.status).toBe('modositasra_visszakuldve');

    const rerun = await processCase(created.caseId, runner());
    expect(rerun?.status).toBe('emberi_ellenorzesre_var');
    expect(seenIntake?.reviewerNote).toContain('olcsóbb');
  });

  it('should require a note when sending back for revision', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    await expect(
      decideCase(created.caseId, { decision: 'revise' }),
    ).rejects.toBeInstanceOf(CaseValidationError);
  });

  it('should reject the case and tell the customer a colleague takes over', async () => {
    const created = await submitCase(INTAKE);
    await processCase(created.caseId, runner());
    await decideCase(created.caseId, {
      decision: 'reject',
      note: 'Telefonon egyeztetünk.',
    });
    const view = await getCustomerView(created.caseId);
    expect(view?.status).toBe('elutasitva');
    expect(view?.recommendation).toBeNull();
    expect(view?.message).toContain('Telefonon');
  });

  it('should refuse to decide a case that is not waiting for review', async () => {
    const created = await submitCase(INTAKE);
    await expect(
      decideCase(created.caseId, { decision: 'approve' }),
    ).rejects.toBeInstanceOf(CaseValidationError);
  });

  it('should refuse to approve a case without a recommendation', async () => {
    const created = await submitCase(INTAKE);
    await processCase(
      created.caseId,
      runner({
        ...goodResult(),
        recommendation: null,
        escalationReason: 'hiányos igény',
      }),
    );
    await expect(
      decideCase(created.caseId, { decision: 'approve' }),
    ).rejects.toBeInstanceOf(CaseValidationError);
  });
});

describe('review queue and metrics', () => {
  it('should list the cases waiting for human review', async () => {
    const first = await submitCase(INTAKE);
    await submitCase({ ...INTAKE, customerEmail: 'bela@example.com' });
    await processCase(first.caseId, runner());
    const waiting = await listReviewCases('emberi_ellenorzesre_var');
    expect(waiting.map((record) => record.caseId)).toEqual([first.caseId]);
  });

  it('should compute the SQL error and human-edit ratios', async () => {
    const clean = await submitCase(INTAKE);
    await processCase(clean.caseId, runner());
    await decideCase(clean.caseId, { decision: 'approve' });

    const messy = await submitCase({
      ...INTAKE,
      customerEmail: 'bela@example.com',
    });
    await processCase(
      messy.caseId,
      runner({ ...goodResult(), sqlAttemptCount: 3, sqlErrorCount: 1 }),
    );

    const metrics = await computeMetrics();
    expect(metrics.totalCases).toBe(2);
    expect(metrics.approvedCases).toBe(1);
    expect(metrics.sqlErrorRatio).toBeCloseTo(1 / 4);
    expect(metrics.approvedWithoutEditRatio).toBe(1);
    expect(metrics.withinBudgetRatio).toBe(1);
    expect(metrics.savedReviewerMinutes).toBe(25);
  });

  it('should return null ratios when there is no data', async () => {
    const metrics = await computeMetrics();
    expect(metrics.totalCases).toBe(0);
    expect(metrics.sqlErrorRatio).toBeNull();
    expect(metrics.approvedWithoutEditRatio).toBeNull();
  });
});
