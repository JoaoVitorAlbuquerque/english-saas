import type { AuditEntry } from '@english-saas/api-client';

import { t, messages, type MessageKey } from '../../../messages/pt-BR';
import { formatBrlCents } from './money';
import { formatFullDay } from './period';
import { planName } from './plan-name';

/**
 * O texto de cada linha do log de auditoria. `details` é JSON solto que o
 * servidor monta por ação; aqui ele é lido com cuidado — uma ação nova ou um
 * campo faltando nunca quebra a tela, só aparece sem o detalhe.
 */

function has(key: string): key is MessageKey {
  return key in messages;
}

export function actionLabel(action: string): string {
  const key = `audit.action.${action}`;

  return has(key) ? t(key) : action;
}

export function targetTypeLabel(targetType: string): string {
  const key = `audit.target.${targetType}`;

  return has(key) ? t(key) : targetType;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldValue(field: string, value: unknown): string {
  if (typeof value === 'boolean') {
    return t(value ? 'audit.value.true' : 'audit.value.false');
  }

  if (field === 'priceCents' && typeof value === 'number') {
    return formatBrlCents(value);
  }

  return value === null || value === undefined ? '—' : String(value);
}

function fieldName(field: string): string {
  const key = `audit.field.${field}`;

  return has(key) ? t(key) : field;
}

/** Uma linha por campo que mudou: `preço: R$ 69,90 → R$ 79,90`. */
export function describeChanges(changes: unknown): string[] {
  return Object.entries(record(changes)).map(([field, change]) => {
    const { from, to } = record(change);

    return t('audit.detail.change', {
      field: fieldName(field),
      from: fieldValue(field, from),
      to: fieldValue(field, to),
    });
  });
}

/** O que mudou, em linhas curtas. Vazio quando não há o que dizer. */
export function describeAudit(entry: AuditEntry): string[] {
  const details = record(entry.details);

  switch (entry.action) {
    case 'credits.bonus': {
      const amount = num(details['amount']);

      return amount === null
        ? []
        : [
            t('audit.detail.bonus', {
              amount,
              balance: num(details['balanceAfter']) ?? '—',
              reason: text(details['reason']),
            }),
          ];
    }

    case 'plan.update': {
      const changes = describeChanges(details['changes']);

      return [
        t('audit.detail.plan', {
          plan: planName(text(details['tier']), text(details['billingPeriod'])),
        }),
        ...(changes.length === 0 ? [t('audit.detail.noChange')] : changes),
      ];
    }

    case 'credit-cost.update': {
      const feature = text(details['feature']);
      const key = `costs.${feature}`;

      return [
        t('audit.detail.cost', {
          feature: has(key) ? t(key) : feature,
          from: num(details['from']) ?? '—',
          to: num(details['to']) ?? '—',
        }),
      ];
    }

    case 'metrics.rebuild':
      return [
        t('audit.detail.rebuild', {
          from: formatFullDay(text(details['from'])),
          to: formatFullDay(text(details['to'])),
        }),
      ];

    case 'student.view':
      return [t('audit.detail.view')];

    default:
      return [];
  }
}
