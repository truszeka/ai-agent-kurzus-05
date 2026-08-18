import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatView } from '@/features/chat/chat-view';
import { IntakeForm } from '@/features/cases/intake-form';
import { CaseStatus } from '@/features/cases/case-status';
import { ReviewConsole } from '@/features/cases/review-console';

// App.tsx — a PoC három felülete egy helyen (use case terv 7. pont):
//   „Igényfelmérő”  — az ügyfél beküldi a szoba adottságait és az igényeit,
//   „Ügyem állapota” — ügyazonosítóval követi az ügyet, jóváhagyás után látja a csomagot,
//   „Ellenőrzés”     — a lakberendező jóváhagy, visszaküld vagy elutasít (a kötelező emberi kapu).
// Negyedikként megmarad a korábbi „Katalógus-chat” (query-agent).
//
// Szándékosan nincs router-függőség: a PoC-hoz elég egy nézetváltó állapot, így a demó egyetlen
// oldalon marad, és nem hoz be új csomagot a webre.

type View = 'intake' | 'status' | 'review' | 'chat';

const TABS: { id: View; label: string }[] = [
  { id: 'intake', label: 'Igényfelmérő' },
  { id: 'status', label: 'Ügyem állapota' },
  { id: 'review', label: 'Ellenőrzés (lakberendező)' },
  { id: 'chat', label: 'Katalógus-chat' },
];

export default function App() {
  const [view, setView] = useState<View>('intake');
  const [caseId, setCaseId] = useState('');

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Leaf className="text-primary" />
        <h1 className="text-lg font-semibold">Plantbase</h1>
        <span className="text-muted-foreground text-sm">
          személyre szabott növénycsomag — emberi jóváhagyással
        </span>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={view === tab.id ? 'default' : 'outline'}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      {view === 'intake' && (
        <IntakeForm
          onSubmitted={(id) => {
            setCaseId(id);
            setView('status');
          }}
        />
      )}
      {view === 'status' && <CaseStatus initialCaseId={caseId} />}
      {view === 'review' && <ReviewConsole />}
      {view === 'chat' && <ChatView />}
    </div>
  );
}
