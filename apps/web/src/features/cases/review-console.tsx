import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  fetchMetrics,
  fetchReviewCases,
  formatHuf,
  sendDecision,
  type CaseMetrics,
  type ReviewCaseView,
} from './cases-api';

// review-console.tsx — LAKBERENDEZŐI ELLENŐRZŐFELÜLET (terv 3. és 7. pont). Ez a KÖTELEZŐ
// EMBERI KAPU: amíg innen nem érkezik jóváhagyás, az ügyfél nem lát ajánlatot.
// A lakberendező mindent lát, ami a döntéshez kell: az eredeti ügyfélkérést, az agent által
// generált SQL-t, a javasolt csomagot, a teljes árat, az indoklást és a figyelmeztetéseket.
//
// A mérési panel a terv 9. pontjának metrikáit mutatja — köztük az SQL-hibaarányt és az ember
// által módosított ajánlatok arányát, mert ezek az agent hibáját is mérik.

const WAITING = 'emberi_ellenorzesre_var';
const TEXTAREA_CLASS =
  'flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function seconds(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} mp`;
}

export function ReviewConsole() {
  const [cases, setCases] = useState<ReviewCaseView[]>([]);
  const [metrics, setMetrics] = useState<CaseMetrics | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [onlyWaiting, setOnlyWaiting] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [list, nextMetrics] = await Promise.all([
        fetchReviewCases(onlyWaiting ? WAITING : undefined),
        fetchMetrics(),
      ]);
      setCases(list);
      setMetrics(nextMetrics);
      setError('');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Ismeretlen hiba.');
    }
  }, [onlyWaiting]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const selected = cases.find((item) => item.caseId === selectedId) ?? null;

  async function decide(
    decision: 'approve' | 'revise' | 'reject',
  ): Promise<void> {
    if (!selected) {
      return;
    }
    setPending(true);
    setError('');
    try {
      await sendDecision(selected.caseId, { decision, note });
      setNote('');
      setSelectedId('');
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Ismeretlen hiba.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      {metrics && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
          <Metric label="Ügyek" value={String(metrics.totalCases)} />
          <Metric label="Jóváhagyva" value={String(metrics.approvedCases)} />
          <Metric
            label="Tervezet ideje"
            value={seconds(metrics.avgDraftSeconds)}
          />
          <Metric
            label="Jóváhagyásig"
            value={seconds(metrics.avgApprovalSeconds)}
          />
          <Metric
            label="SQL-hibaarány"
            value={percent(metrics.sqlErrorRatio)}
          />
          <Metric
            label="Módosítás nélkül"
            value={percent(metrics.approvedWithoutEditRatio)}
          />
          <Metric label="Eszkaláció" value={percent(metrics.escalationRatio)} />
          <Metric
            label="Kereten belül"
            value={percent(metrics.withinBudgetRatio)}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant={onlyWaiting ? 'default' : 'outline'}
          onClick={() => setOnlyWaiting(true)}
        >
          Várólista
        </Button>
        <Button
          variant={onlyWaiting ? 'outline' : 'default'}
          onClick={() => setOnlyWaiting(false)}
        >
          Minden ügy
        </Button>
      </div>

      {error !== '' && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <ul className="space-y-2">
          {cases.length === 0 && (
            <li className="text-muted-foreground text-sm">
              Nincs megjeleníthető ügy.
            </li>
          )}
          {cases.map((item) => (
            <li key={item.caseId}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(item.caseId);
                  setNote('');
                }}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  item.caseId === selectedId ? 'border-primary bg-muted' : ''
                }`}
              >
                <span className="font-mono">{item.caseId}</span>
                <span className="text-muted-foreground block text-xs">
                  {item.intake.roomType} · {formatHuf(item.intake.budgetHuf)}
                </span>
                {item.escalationReason && (
                  <span className="text-destructive block text-xs">
                    eszkaláció
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <article className="space-y-4 rounded-lg border p-4 text-sm">
            <header>
              <h2 className="font-mono text-base font-semibold">
                {selected.caseId}
              </h2>
              <p className="text-muted-foreground text-xs">
                állapot: {selected.status}
              </p>
            </header>

            <Block title="Az ügyfél eredeti igénye">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Row label="Szoba" value={selected.intake.roomType} />
                <Row label="Fény" value={selected.intake.light} />
                <Row label="Hely" value={selected.intake.spaceDescription} />
                <Row
                  label="Stílus"
                  value={selected.intake.stylePreference || '—'}
                />
                <Row
                  label="Keret"
                  value={formatHuf(selected.intake.budgetHuf)}
                />
                <Row
                  label="Elvárás"
                  value={selected.intake.specialRequests || '—'}
                />
              </dl>
            </Block>

            <Block
              title={`Az agent SQL-jei (${selected.sqlErrorCount}/${selected.sqlAttemptCount} hibás)`}
            >
              {selected.agentSql.length === 0 ? (
                <p className="text-muted-foreground">Nem futott SQL.</p>
              ) : (
                <ul className="space-y-1">
                  {selected.agentSql.map((sql, index) => (
                    <li
                      key={index}
                      className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs"
                    >
                      {sql}
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            {selected.escalationReason && (
              <p className="border-destructive text-destructive rounded-md border p-3">
                Eszkaláció: {selected.escalationReason}
              </p>
            )}

            <Block title="A javasolt növénycsomag">
              {selected.recommendation ? (
                <div className="space-y-2">
                  <ul className="space-y-1">
                    {selected.recommendation.items.map((item) => (
                      <li
                        key={item.name}
                        className="flex justify-between gap-4"
                      >
                        <span>
                          {item.name}
                          {item.latinName !== '' && (
                            <span className="text-muted-foreground italic">
                              {' '}
                              ({item.latinName})
                            </span>
                          )}
                          {item.reason !== '' && (
                            <span className="text-muted-foreground block text-xs">
                              {item.reason}
                            </span>
                          )}
                        </span>
                        <span>{formatHuf(item.priceHuf)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="font-semibold">
                    Teljes ár:{' '}
                    {formatHuf(selected.recommendation.totalPriceHuf)}
                  </p>
                  <p>{selected.recommendation.reasoning}</p>
                  <p className="text-muted-foreground text-xs">
                    az agent biztonsága:{' '}
                    {selected.recommendation.confidence.toFixed(2)}
                  </p>
                  {selected.recommendation.warnings.length > 0 && (
                    <ul className="text-destructive list-inside list-disc text-xs">
                      {selected.recommendation.warnings.map(
                        (warning, index) => (
                          <li key={index}>{warning}</li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Az agent nem készített csomagot — emberi döntés kell.
                </p>
              )}
            </Block>

            {selected.status === WAITING ? (
              <div className="space-y-2 border-t pt-3">
                <textarea
                  className={TEXTAREA_CLASS}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Megjegyzés (visszaküldéshez kötelező)"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending}
                    onClick={() => void decide('approve')}
                  >
                    Jóváhagyás
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void decide('revise')}
                  >
                    Visszaküldés módosításra
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void decide('reject')}
                  >
                    Elutasítás
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground border-t pt-3 text-xs">
                Ez az ügy már el van döntve ({selected.reviewerDecision ?? '—'}
                ).
              </p>
            )}
          </article>
        ) : (
          <p className="text-muted-foreground text-sm">
            Válassz egy ügyet a listából.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
