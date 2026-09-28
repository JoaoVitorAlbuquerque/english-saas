import { Loader2 } from 'lucide-react';

export function FullScreenLoader({
  label = 'Carregando…',
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground">
      <Loader2 className="size-6 animate-spin text-muted" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
