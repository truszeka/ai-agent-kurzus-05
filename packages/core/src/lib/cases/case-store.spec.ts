import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCase, listCases, saveCase, updateCase } from './case-store.js';
import { CaseRecordSchema, type CaseRecord } from './case-schema.js';

function buildRecord(caseId: string, createdAt: string): CaseRecord {
  return CaseRecordSchema.parse({
    caseId,
    createdAt,
    status: 'beerkezett',
    intake: {
      customerName: 'Teszt Elek',
      customerEmail: 'teszt@example.com',
      roomType: 'nappali',
      light: 'közepes',
      spaceDescription: 'egy 40 cm-es polc',
      stylePreference: 'zöld, letisztult',
      budgetHuf: 20000,
      specialRequests: '',
    },
  });
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plantbase-cases-'));
  process.env['CASES_FILE'] = join(dir, 'cases.json');
});

afterEach(async () => {
  delete process.env['CASES_FILE'];
  await rm(dir, { recursive: true, force: true });
});

describe('case-store', () => {
  it('should return null when the case is unknown', async () => {
    expect(await getCase('PB-NINCS')).toBeNull();
  });

  it('should save and read back a case', async () => {
    await saveCase(buildRecord('PB-1', '2026-08-18T10:00:00.000Z'));
    const found = await getCase('PB-1');
    expect(found?.intake.customerEmail).toBe('teszt@example.com');
  });

  it('should list newest case first', async () => {
    await saveCase(buildRecord('PB-1', '2026-08-18T10:00:00.000Z'));
    await saveCase(buildRecord('PB-2', '2026-08-18T11:00:00.000Z'));
    const ids = (await listCases()).map((record) => record.caseId);
    expect(ids).toEqual(['PB-2', 'PB-1']);
  });

  it('should filter the list by status', async () => {
    await saveCase(buildRecord('PB-1', '2026-08-18T10:00:00.000Z'));
    await saveCase(buildRecord('PB-2', '2026-08-18T11:00:00.000Z'));
    await updateCase('PB-2', (record) => ({
      ...record,
      status: 'emberi_ellenorzesre_var',
    }));
    const waiting = await listCases('emberi_ellenorzesre_var');
    expect(waiting.map((record) => record.caseId)).toEqual(['PB-2']);
  });

  it('should return null when updating an unknown case', async () => {
    expect(await updateCase('PB-NINCS', (record) => record)).toBeNull();
  });

  it('should not lose records on concurrent writes', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_unused, index) =>
        saveCase(buildRecord(`PB-${index}`, `2026-08-18T10:0${index}:00.000Z`)),
      ),
    );
    expect(await listCases()).toHaveLength(10);
  });

  it('should skip corrupted records instead of failing', async () => {
    await writeFile(
      process.env['CASES_FILE'] as string,
      JSON.stringify([
        { caseId: 'rossz' },
        buildRecord('PB-9', '2026-08-18T10:00:00.000Z'),
      ]),
      'utf8',
    );
    const records = await listCases();
    expect(records.map((record) => record.caseId)).toEqual(['PB-9']);
  });
});
