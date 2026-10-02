import type { DataExportView } from '@english-saas/api-client';

export type ExportState =
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'ready'; downloadUrl: string }
  /** Ficou pronto, mas o link assinado já venceu: é preciso pedir de novo. */
  | { kind: 'expired' }
  | { kind: 'failed' };

/** Traduz o que a API devolve no que a tela mostra. `null` = nunca pediu. */
export function exportStateOf(view: DataExportView | null): ExportState {
  if (view === null) {
    return { kind: 'none' };
  }

  switch (view.status) {
    case 'PENDING':
      return { kind: 'pending' };
    case 'FAILED':
      return { kind: 'failed' };
    case 'READY':
      return view.downloadUrl === null
        ? { kind: 'expired' }
        : { kind: 'ready', downloadUrl: view.downloadUrl };
  }
}
