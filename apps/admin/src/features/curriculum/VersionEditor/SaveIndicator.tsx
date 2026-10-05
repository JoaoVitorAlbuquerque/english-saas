import { Button } from '@english-saas/ui';
import { Check, Loader2, TriangleAlert } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import type { AutosaveState } from '../lib/autosave-machine';

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' });

/**
 * O estado do salvamento, sempre visível: com texto (nunca só cor ou ícone)
 * e anunciado ao leitor de tela quando muda.
 */
export function SaveIndicator({
  state,
  readOnly,
  unsavedFields,
  onRetry,
}: {
  state: AutosaveState;
  readOnly: boolean;
  /** Campos dos metadados com erro, que por isso não foram salvos. */
  unsavedFields: string[];
  onRetry: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="text-sm">
      {readOnly ? (
        <span className="text-muted">{t('editor.save.readOnly')}</span>
      ) : state.status === 'saving' ? (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('editor.save.saving')}
        </span>
      ) : state.status === 'dirty' ? (
        <span className="text-muted">{t('editor.save.dirty')}</span>
      ) : state.status === 'error' ? (
        <span className="inline-flex flex-wrap items-center gap-2 text-error">
          <TriangleAlert className="size-4" aria-hidden="true" />
          {t('editor.save.error')}
          <Button size="sm" variant="ghost" onClick={onRetry}>
            {t('editor.save.retry')}
          </Button>
        </span>
      ) : state.status === 'saved' && state.savedAt !== null ? (
        <span className="inline-flex items-center gap-1.5 text-ok">
          <Check className="size-4" aria-hidden="true" />
          {t('editor.save.saved', {
            time: timeFormat.format(new Date(state.savedAt)),
          })}
        </span>
      ) : (
        <span className="text-muted">{t('editor.save.clean')}</span>
      )}
      {unsavedFields.length > 0 && !readOnly ? (
        <p className="mt-1 text-xs text-error">
          {t('editor.save.invalidMeta', { fields: unsavedFields.join(', ') })}
        </p>
      ) : null}
    </div>
  );
}
