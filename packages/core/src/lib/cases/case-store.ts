import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  CaseRecordSchema,
  type CaseRecord,
  type CaseStatus,
} from './case-schema.js';

// case-store.ts — az ügyek EGYSZERŰ, fájl-alapú tárolója (terv 8. pont: SQLite vagy JSON).
// JSON-t választottunk: a `products` katalógus így érintetlen, read-only Postgres marad, a
// PoC-hoz pedig nem kell külön migráció. A tároló szándékosan buta: olvas, ír, listáz —
// az üzleti szabályok a case-service-ben laknak.
//
// SORBA ÁLLÍTOTT ÍRÁS: az Express több kérést párhuzamosan szolgál ki, egy JSON fájl viszont
// nem tűri a párhuzamos read-modify-write-ot. Minden művelet EGY promise-láncra fűződik, így
// a "beolvas → módosít → kiír" ciklusok soha nem lapolódnak át.

const DEFAULT_FILE = join(process.cwd(), 'data', 'cases.json');

function storeFile(): string {
  return process.env['CASES_FILE'] ?? DEFAULT_FILE;
}

/** A soros végrehajtás lánca — minden művelet ennek a végére fűződik. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  // A lánc nem törhet meg egy elbukott művelettől: a hibát itt lenyeljük, a hívó megkapja.
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Nyers olvasás. Sérült fájl / sérült rekord nem dönti el a rendszert: kihagyjuk. */
async function readAll(): Promise<CaseRecord[]> {
  let raw: string;
  try {
    raw = await readFile(storeFile(), 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const records: CaseRecord[] = [];
  for (const item of parsed) {
    const result = CaseRecordSchema.safeParse(item);
    if (result.success) {
      records.push(result.data);
    }
  }
  return records;
}

async function writeAll(records: CaseRecord[]): Promise<void> {
  const file = storeFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

/** Új ügy mentése. A rekordot a hívó (case-service) állítja össze. */
export async function saveCase(record: CaseRecord): Promise<CaseRecord> {
  return enqueue(async () => {
    const records = await readAll();
    await writeAll([...records, record]);
    return record;
  });
}

export async function getCase(caseId: string): Promise<CaseRecord | null> {
  return enqueue(async () => {
    const records = await readAll();
    return records.find((record) => record.caseId === caseId) ?? null;
  });
}

export async function listCases(status?: CaseStatus): Promise<CaseRecord[]> {
  return enqueue(async () => {
    const records = await readAll();
    const filtered = status
      ? records.filter((record) => record.status === status)
      : records;
    // Legfrissebb elöl — a lakberendezői várólista így olvasható.
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/**
 * Atomi módosítás: a `mutate` a MENTETT állapotot kapja meg, és az újat adja vissza.
 * Ismeretlen ügy esetén null (a hívó dönt, mit jelent ez).
 */
export async function updateCase(
  caseId: string,
  mutate: (record: CaseRecord) => CaseRecord,
): Promise<CaseRecord | null> {
  return enqueue(async () => {
    const records = await readAll();
    const index = records.findIndex((record) => record.caseId === caseId);
    if (index === -1) {
      return null;
    }
    const current = records[index] as CaseRecord;
    const updated = CaseRecordSchema.parse(mutate(current));
    const next = [
      ...records.slice(0, index),
      updated,
      ...records.slice(index + 1),
    ];
    await writeAll(next);
    return updated;
  });
}
