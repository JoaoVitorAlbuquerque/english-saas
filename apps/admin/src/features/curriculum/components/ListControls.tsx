import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

import { t } from '../../../messages/pt-BR';

const BUTTON =
  'flex size-8 items-center justify-center rounded-lg text-muted hover:bg-ground disabled:opacity-30';

/**
 * Subir, descer e remover um item de lista. `label` diz de qual item se
 * trata ("fala 2") — o leitor de tela lê "Subir fala 2", não só "Subir".
 */
export function ListControls({
  label,
  index,
  count,
  disabled = false,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove?: (() => void) | undefined;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        className={BUTTON}
        aria-label={`${t('editor.list.moveUp')} ${label}`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-label={`${t('editor.list.moveDown')} ${label}`}
        disabled={disabled || index >= count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </button>
      {onRemove ? (
        <button
          type="button"
          className={BUTTON}
          aria-label={`${t('editor.list.remove')} ${label}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
