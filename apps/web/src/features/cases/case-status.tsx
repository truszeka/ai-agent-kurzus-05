import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchCase, formatHuf, type CustomerCaseView } from './cases-api';

// case-status.tsx — ÜGYFÉLOLDALI STÁTUSZOLDAL (terv 7. pont). Az ügyazonosítóval megnézhető,
// hol tart az ügy; a növénycsomag, a teljes ár és az indoklás CSAK jóváhagyás után jelenik meg
// (a szerver a jóváhagyatlan ajánlatot ki sem küldi).
//
// Amíg emberi ellenőrzésre vár, 5 másodpercenként frissítünk, hogy a demóban élőben látszódjon
// a jóváhagyás pillanata.

const POLL_MS = 5000;
const OPEN_STATUSES = [
  'beerkezett',
  'feldolgozas_alatt',
  'emberi_ellenorzesre_var',
  'modositasra_visszakuldve',
];

export interface CaseStatusProps {
  initialCaseId?: string;
}

export function CaseStatus({ initialCaseId = '' }: CaseStatusProps) {
  const [caseId, setCaseId] = useState(initialCaseId);
  const [query, setQuery] = useState(initialCaseId);
  const [view, setView] = useState<CustomerCaseView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setCaseId(initialCaseId);
    setQuery(initialCaseId);
  }, [initialCaseId]);

  useEffect(() => {
    if (caseId === '') {
      return;
    }
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const next = await fetchCase(caseId);
        if (!cancelled) {
          setView(next);
          setError('');
        }
      } catch (caught: unknown) {
        if (!cancelled) {
          setView(null);
          setError(
            caught instanceof Error ? caught.message : 'Ismeretlen hiba.',
          );
        }
      }
    }

    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [caseId]);

  const open = view !== null && OPEN_STATUSES.includes(view.status);

  return (
    <section className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCaseId(query.trim().toUpperCase());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ügyazonosító, pl. PB-7QK3ZA"
        />
        <Button type="submit">Megnézem</Button>
      </form>

      {error !== '' && <p className="text-destructive text-sm">{error}</p>}

      {view && (
        <div className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{view.caseId}</h2>
              <p className="text-muted-foreground text-xs">
                beérkezett: {new Date(view.createdAt).toLocaleString('hu-HU')}
              </p>
            </div>
            <span className="bg-muted rounded-full px-3 py-1 text-sm font-medium">
              {view.statusLabel}
            </span>
          </div>

          <p className="text-sm">{view.message}</p>
          {open && (
            <p className="text-muted-foreground text-xs">
              Az oldal magától frissül…
            </p>
          )}

          <ol className="text-muted-foreground space-y-1 text-xs">
            {view.statusHistory.map((change, index) => (
              <li key={`${change.status}-${index}`}>
                {new Date(change.at).toLocaleTimeString('hu-HU')} —{' '}
                {change.status}
                {change.note !== '' ? ` (${change.note})` : ''}
              </li>
            ))}
          </ol>

          {view.recommendation && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">A javasolt növénycsomag</h3>
              <ul className="space-y-2">
                {view.recommendation.items.map((item) => (
                  <li key={item.name} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium">
                        {item.name}
                        {item.latinName !== '' && (
                          <span className="text-muted-foreground italic">
                            {' '}
                            ({item.latinName})
                          </span>
                        )}
                      </span>
                      <span>{formatHuf(item.priceHuf)}</span>
                    </div>
                    {item.reason !== '' && (
                      <p className="text-muted-foreground mt-1">
                        {item.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="font-semibold">
                Teljes ár: {formatHuf(view.recommendation.totalPriceHuf)}
              </p>
              <p className="text-sm">{view.recommendation.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
