import { CEFR_LEVELS } from '@english-saas/shared';

/**
 * Placeholder. O front-end entra depois — o foco agora é o back-end.
 */
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-slate-100">
      <h1 className="text-3xl font-semibold">english-saas</h1>
      <p className="text-slate-400">
        Inglês do jeito que as pessoas realmente falam.
      </p>
      <div className="flex gap-2">
        {CEFR_LEVELS.map((level) => (
          <span
            key={level}
            className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300"
          >
            {level}
          </span>
        ))}
      </div>
    </main>
  );
}
