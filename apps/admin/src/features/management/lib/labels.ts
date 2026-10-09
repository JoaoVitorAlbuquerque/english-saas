import type { AdminUserRow } from '@english-saas/api-client';

import { messages, t, type MessageKey } from '../../../messages/pt-BR';

function has(key: string): key is MessageKey {
  return key in messages;
}

/** O nome do recurso de IA (o id do prompt); desconhecido aparece como veio. */
export function aiFeatureLabel(feature: string): string {
  const key = `ai.feature.${feature}`;

  return has(key) ? t(key) : feature;
}

/** O nome de uma ação que gasta crédito. */
export function creditActionLabel(feature: string): string {
  const key = `costs.${feature}`;

  return has(key) ? t(key) : feature;
}

export type StudentStatus = 'ACTIVE' | 'DELETED' | 'ANONYMIZED';

/** Anonimizada vale mais que "exclusão pedida": os dados já foram apagados. */
export function studentStatus(
  user: Pick<AdminUserRow, 'deletedAt' | 'anonymizedAt'>,
): StudentStatus {
  if (user.anonymizedAt !== null) {
    return 'ANONYMIZED';
  }

  return user.deletedAt !== null ? 'DELETED' : 'ACTIVE';
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

/** Instante ISO no fuso de quem olha. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

const numberFormat = new Intl.NumberFormat('pt-BR');

export function formatInt(value: number): string {
  return numberFormat.format(value);
}

/** `0.7` → `70%`; `null` vira o traço. */
export function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${String(Math.round(rate * 100))}%`;
}
