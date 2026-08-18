import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitCase } from './cases-api';

// intake-form.tsx — ÜGYFÉLOLDALI IGÉNYFELMÉRŐ (terv 7. pont). Strukturáltan kérdezi végig a
// szobát és az igényeket, majd beküldés után az EGYEDI ÜGYAZONOSÍTÓT mutatja — ezzel követhető
// az ügy a státuszoldalon. A feldolgozás a szerveren a háttérben indul.

const ROOM_TYPES = [
  'nappali',
  'hálószoba',
  'konyha',
  'fürdőszoba',
  'dolgozószoba',
  'előszoba',
  'iroda',
];
const LIGHT_LEVELS = ['árnyék', 'alacsony', 'közepes', 'erős', 'direkt nap'];

const FIELD_LABEL = 'text-sm font-medium';
const TEXTAREA_CLASS =
  'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export interface IntakeFormProps {
  /** Beküldés után az ügyazonosítót átadjuk a szülőnek (a státuszoldal ezzel nyílik meg). */
  onSubmitted: (caseId: string) => void;
}

export function IntakeForm({ onSubmitted }: IntakeFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [roomType, setRoomType] = useState(ROOM_TYPES[0] as string);
  const [light, setLight] = useState(LIGHT_LEVELS[2] as string);
  const [spaceDescription, setSpaceDescription] = useState('');
  const [stylePreference, setStylePreference] = useState('');
  const [budget, setBudget] = useState('20000');
  const [specialRequests, setSpecialRequests] = useState('');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [caseId, setCaseId] = useState('');

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await submitCase({
        customerName,
        customerEmail,
        roomType,
        light,
        spaceDescription,
        stylePreference,
        budgetHuf: Number(budget),
        specialRequests,
      });
      setCaseId(result.caseId);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Ismeretlen hiba.');
    } finally {
      setPending(false);
    }
  }

  if (caseId !== '') {
    return (
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Megkaptuk az igényed</h2>
        <p className="text-sm">
          Az ügyazonosítód:{' '}
          <span className="bg-muted rounded px-2 py-1 font-mono text-base">
            {caseId}
          </span>
        </p>
        <p className="text-muted-foreground text-sm">
          Az ajánlattervezetet az asszisztensünk állítja össze, majd
          lakberendező kollégánk ellenőrzi. Az ügyazonosítóddal bármikor
          megnézheted, hol tart az ügyed.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onSubmitted(caseId)}>Ügyem állapota</Button>
          <Button variant="outline" onClick={() => setCaseId('')}>
            Új igény
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="space-y-4 rounded-lg border p-6"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div>
        <h2 className="text-lg font-semibold">Igényfelmérő</h2>
        <p className="text-muted-foreground text-sm">
          Mondd el, milyen a szoba és mit szeretnél — összeállítunk egy
          növénycsomagot.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Neved</span>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>E-mail-címed</span>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Szoba típusa</span>
          <select
            className={SELECT_CLASS}
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
          >
            {ROOM_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Fényviszonyok</span>
          <select
            className={SELECT_CLASS}
            value={light}
            onChange={(e) => setLight(e.target.value)}
          >
            {LIGHT_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={FIELD_LABEL}>Rendelkezésre álló hely</span>
          <textarea
            className={TEXTAREA_CLASS}
            value={spaceDescription}
            onChange={(e) => setSpaceDescription(e.target.value)}
            placeholder="pl. két 30 cm-es polc az ablak mellett és egy 1 m-es sarok"
            required
          />
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Szín / stílus</span>
          <Input
            value={stylePreference}
            onChange={(e) => setStylePreference(e.target.value)}
            placeholder="pl. sötétzöld, letisztult"
          />
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Költségkeret (Ft)</span>
          <Input
            type="number"
            min={1}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={FIELD_LABEL}>Különleges elvárások</span>
          <textarea
            className={TEXTAREA_CLASS}
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="pl. macskabarát, keveset kell öntözni"
          />
        </label>
      </div>

      {error !== '' && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Beküldés…' : 'Igény beküldése'}
      </Button>
    </form>
  );
}
