import { z } from 'zod';

// case-schema.ts — az ÜGY fogalma: mit ad be az ügyfél, mit állít elő az agent, és milyen
// állapotokon megy át az ügy. Minden más (tároló, szolgáltatás, HTTP, UI) EZEKRE a típusokra
// épül. Rendszer-határon (HTTP body, JSON fájl, LLM-kimenet) mindig ezek a sémák validálnak.
//
// ADATVÉDELEM: a rekordban ott van az ügyfél neve és e-mail-címe, de a MODELLHEZ csak a
// `toModelIntake()` szűkített nézete jut el (szoba, preferenciák, büdzsé) — a terv 8. pontja.

/** Az ügy állapotai. A sorrend egyben a normál életút is. */
export const CASE_STATUSES = [
  'beerkezett',
  'feldolgozas_alatt',
  'emberi_ellenorzesre_var',
  'jovahagyva',
  'ajanlat_elkeszult',
  'modositasra_visszakuldve',
  'elutasitva',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Emberi olvasásra szánt állapot-címkék (az ügyféloldali státuszoldal ezt mutatja). */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  beerkezett: 'Beérkezett',
  feldolgozas_alatt: 'Feldolgozás alatt',
  emberi_ellenorzesre_var: 'Emberi ellenőrzésre vár',
  jovahagyva: 'Jóváhagyva',
  ajanlat_elkeszult: 'Ajánlat elkészült',
  modositasra_visszakuldve: 'Módosításra visszaküldve',
  elutasitva: 'Elutasítva',
};

/** Az EGYETLEN állapot, amelyben az ajánlat láthatóvá válik az ügyfélnek. */
export const CUSTOMER_VISIBLE_STATUS: CaseStatus = 'ajanlat_elkeszult';

// --- Ügyfél-bemenet (igényfelmérő űrlap) --------------------------------------------------

export const CaseIntakeSchema = z.object({
  customerName: z.string().trim().min(2, 'Add meg a neved.'),
  customerEmail: z.email('Érvényes e-mail-cím kell.'),
  roomType: z.string().trim().min(2, 'Add meg a szoba típusát.'),
  light: z.string().trim().min(2, 'Add meg a fényviszonyokat.'),
  spaceDescription: z
    .string()
    .trim()
    .min(2, 'Írd le a rendelkezésre álló helyet.'),
  stylePreference: z.string().trim().default(''),
  budgetHuf: z.number().int().positive('A költségkeret pozitív szám legyen.'),
  specialRequests: z.string().trim().default(''),
});
export type CaseIntake = z.infer<typeof CaseIntakeSchema>;

/** Amit a MODELL megkap: se név, se e-mail. */
export interface ModelIntake {
  roomType: string;
  light: string;
  spaceDescription: string;
  stylePreference: string;
  budgetHuf: number;
  specialRequests: string;
  /** Lakberendezői megjegyzés újrafuttatáskor (módosításra visszaküldés). */
  reviewerNote?: string;
}

export function toModelIntake(
  intake: CaseIntake,
  reviewerNote?: string,
): ModelIntake {
  return {
    roomType: intake.roomType,
    light: intake.light,
    spaceDescription: intake.spaceDescription,
    stylePreference: intake.stylePreference,
    budgetHuf: intake.budgetHuf,
    specialRequests: intake.specialRequests,
    ...(reviewerNote ? { reviewerNote } : {}),
  };
}

// --- Az agent által előállított ajánlat ---------------------------------------------------

export const RecommendationItemSchema = z.object({
  name: z.string().min(1),
  latinName: z.string().default(''),
  priceHuf: z.number().nonnegative(),
  reason: z.string().default(''),
});
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const CaseRecommendationSchema = z.object({
  items: z.array(RecommendationItemSchema),
  totalPriceHuf: z.number().nonnegative(),
  reasoning: z.string().default(''),
  warnings: z.array(z.string()).default([]),
  /** Az agent önbevallott biztonsága (0..1). Alacsony érték → eszkaláció. */
  confidence: z.number().min(0).max(1),
  /** Ha ki van töltve, az agent maga kéri az emberi döntést. */
  escalationReason: z.string().nullable().default(null),
});
export type CaseRecommendation = z.infer<typeof CaseRecommendationSchema>;

// --- Az ügy rekordja ----------------------------------------------------------------------

export const StatusChangeSchema = z.object({
  status: z.enum(CASE_STATUSES),
  at: z.string(),
  note: z.string().default(''),
});
export type StatusChange = z.infer<typeof StatusChangeSchema>;

export const REVIEWER_DECISIONS = ['approve', 'revise', 'reject'] as const;
export type ReviewerDecision = (typeof REVIEWER_DECISIONS)[number];

export const CaseRecordSchema = z.object({
  caseId: z.string().min(1),
  createdAt: z.string(),
  status: z.enum(CASE_STATUSES),
  statusHistory: z.array(StatusChangeSchema).default([]),
  intake: CaseIntakeSchema,
  recommendation: CaseRecommendationSchema.nullable().default(null),
  /** Az agent által futtatott SQL-ek — a lakberendező ezt is látja (terv 3. pont). */
  agentSql: z.array(z.string()).default([]),
  sqlAttemptCount: z.number().int().nonnegative().default(0),
  sqlErrorCount: z.number().int().nonnegative().default(0),
  escalationReason: z.string().nullable().default(null),
  /** Mikor lett kész a tervezet (emberi ellenőrzésre vár) — mérési terv. */
  draftReadyAt: z.string().nullable().default(null),
  reviewerDecision: z.enum(REVIEWER_DECISIONS).nullable().default(null),
  reviewerNote: z.string().default(''),
  /** Igaz, ha az ember hozzányúlt a tervezethez jóváhagyás előtt (mérési terv). */
  reviewerModified: z.boolean().default(false),
  reviewedAt: z.string().nullable().default(null),
});
export type CaseRecord = z.infer<typeof CaseRecordSchema>;

// --- Ügyfélnézet --------------------------------------------------------------------------

export interface CustomerCaseView {
  caseId: string;
  createdAt: string;
  status: CaseStatus;
  statusLabel: string;
  statusHistory: StatusChange[];
  /** CSAK jóváhagyás után (ajanlat_elkeszult). Minden más állapotban null. */
  recommendation: CaseRecommendation | null;
  /** Ha a rendszer emberhez irányította az ügyet, itt mondjuk el az ügyfélnek. */
  message: string;
}

const WAITING_MESSAGE =
  'Az ajánlattervezet elkészült, jelenleg lakberendező kollégánk ellenőrzi. ' +
  'Jóváhagyás után itt látod majd a csomagot.';

/**
 * Az ügyfélnek szánt, SZŰRT nézet. Ez az egyetlen út, amin ajánlat kimehet az ügyfélhez —
 * és csak `ajanlat_elkeszult` státuszban ad vissza ajánlatot (kötelező emberi kapu).
 */
export function toCustomerView(record: CaseRecord): CustomerCaseView {
  const approved = record.status === CUSTOMER_VISIBLE_STATUS;
  return {
    caseId: record.caseId,
    createdAt: record.createdAt,
    status: record.status,
    statusLabel: CASE_STATUS_LABELS[record.status],
    statusHistory: record.statusHistory,
    recommendation: approved ? record.recommendation : null,
    message: buildCustomerMessage(record, approved),
  };
}

function buildCustomerMessage(record: CaseRecord, approved: boolean): string {
  if (approved) {
    return 'Az ajánlatod jóváhagyva, alább látod a javasolt növénycsomagot.';
  }
  if (record.status === 'elutasitva') {
    return (
      'Az ügyedet kollégánk átvette, és személyesen keres meg téged. ' +
      (record.reviewerNote ||
        'Automatikus ajánlatot ebben az esetben nem küldünk.')
    );
  }
  if (record.status === 'emberi_ellenorzesre_var') {
    return WAITING_MESSAGE;
  }
  return 'Az igényedet megkaptuk, dolgozunk az ajánlaton.';
}
