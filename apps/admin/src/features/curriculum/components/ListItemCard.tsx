import type { ReactNode } from 'react';

import { ListControls } from './ListControls';

/** Cartão de um item de lista (fala, card, critério) com seus controles. */
export function ListItemCard({
  title,
  label,
  index,
  count,
  readOnly,
  onMove,
  onRemove,
  fieldPath,
  children,
}: {
  /** Título visível: "Fala 2". */
  title: string;
  /** Nome para leitor de tela nos controles: "fala 2". */
  label: string;
  index: number;
  count: number;
  readOnly: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove?: (() => void) | undefined;
  fieldPath?: string;
  children: ReactNode;
}) {
  return (
    <li
      data-field={fieldPath}
      className="space-y-3 rounded-xl border border-line bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        {readOnly ? null : (
          <ListControls
            label={label}
            index={index}
            count={count}
            onMove={onMove}
            onRemove={onRemove}
          />
        )}
      </div>
      {children}
    </li>
  );
}
