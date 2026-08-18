// cases-api.ts — a webes réteg EGYETLEN kapcsolata az ügy-végpontokkal. A típusok tükrözik a
// szerver válaszait (a core case-schema.ts alakjait); a UI komponensek csak ezeket használják.
// A web app a core-t NEM importálja — HTTP-n beszél, ahogy a chat is (architektura.md).

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';

export interface RecommendationItem {
  name: string;
  latinName: string;
  priceHuf: number;
  reason: string;
}

export interface CaseRecommendation {
  items: RecommendationItem[];
  totalPriceHuf: number;
  reasoning: string;
  warnings: string[];
  confidence: number;
  escalationReason: string | null;
}

export interface StatusChange {
  status: string;
  at: string;
  note: string;
}

export interface CaseIntake {
  customerName: string;
  customerEmail: string;
  roomType: string;
  light: string;
  spaceDescription: string;
  stylePreference: string;
  budgetHuf: number;
  specialRequests: string;
}

export interface CustomerCaseView {
  caseId: string;
  createdAt: string;
  status: string;
  statusLabel: string;
  statusHistory: StatusChange[];
  recommendation: CaseRecommendation | null;
  message: string;
}

export interface ReviewCaseView {
  caseId: string;
  createdAt: string;
  status: string;
  statusHistory: StatusChange[];
  intake: CaseIntake;
  recommendation: CaseRecommendation | null;
  agentSql: string[];
  sqlAttemptCount: number;
  sqlErrorCount: number;
  escalationReason: string | null;
  draftReadyAt: string | null;
  reviewerDecision: 'approve' | 'revise' | 'reject' | null;
  reviewerNote: string;
  reviewerModified: boolean;
  reviewedAt: string | null;
}

export interface CaseMetrics {
  totalCases: number;
  draftedCases: number;
  approvedCases: number;
  rejectedCases: number;
  avgDraftSeconds: number | null;
  avgApprovalSeconds: number | null;
  approvedWithoutEditRatio: number | null;
  escalationRatio: number | null;
  sqlErrorRatio: number | null;
  withinBudgetRatio: number | null;
  savedReviewerMinutes: number;
}

/** A szerver hibáit beszédes üzenetként dobjuk tovább — a UI ezt mutatja a felhasználónak. */
export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const text = await response.text();
  const payload: unknown = text === '' ? null : JSON.parse(text);
  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      `Hiba (${response.status}).`;
    throw new ApiError(message);
  }
  return payload as T;
}

export async function submitCase(intake: {
  customerName: string;
  customerEmail: string;
  roomType: string;
  light: string;
  spaceDescription: string;
  stylePreference: string;
  budgetHuf: number;
  specialRequests: string;
}): Promise<{ caseId: string; status: string }> {
  return request('/api/cases', {
    method: 'POST',
    body: JSON.stringify(intake),
  });
}

export async function fetchCase(caseId: string): Promise<CustomerCaseView> {
  return request(`/api/cases/${encodeURIComponent(caseId)}`);
}

export async function fetchReviewCases(
  status?: string,
): Promise<ReviewCaseView[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/review/cases${query}`);
}

export async function sendDecision(
  caseId: string,
  body: {
    decision: 'approve' | 'revise' | 'reject';
    note?: string;
    recommendation?: CaseRecommendation;
  },
): Promise<ReviewCaseView> {
  return request(`/api/review/cases/${encodeURIComponent(caseId)}/decision`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMetrics(): Promise<CaseMetrics> {
  return request('/api/review/metrics');
}

export function formatHuf(value: number): string {
  return `${value.toLocaleString('hu-HU')} Ft`;
}
