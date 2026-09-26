import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token do link "parar de receber este tipo" do e-mail. Sem expiração e sem
 * estado no banco: é `aluno.tipo` assinado com HMAC. Quem tem o link só
 * consegue desligar aquele tipo de aviso daquele aluno — nada mais.
 */

export type UnsubscribableType =
  'DAILY_REMINDER' | 'REVIEW_BACKLOG' | 'WEEKLY_SUMMARY';

const TYPES: readonly UnsubscribableType[] = [
  'DAILY_REMINDER',
  'REVIEW_BACKLOG',
  'WEEKLY_SUMMARY',
];

export function signUnsubscribe(
  userId: string,
  type: UnsubscribableType,
  secret: string,
): string {
  const payload = Buffer.from(`${userId}.${type}`).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUnsubscribe(
  token: string,
  secret: string,
): { userId: string; type: UnsubscribableType } | null {
  const [payload, signature, ...rest] = token.split('.');

  if (payload === undefined || signature === undefined || rest.length > 0) {
    return null;
  }

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  const [userId, type] = Buffer.from(payload, 'base64url')
    .toString('utf8')
    .split('.');

  if (
    userId === undefined ||
    type === undefined ||
    !TYPES.includes(type as UnsubscribableType)
  ) {
    return null;
  }

  return { userId, type: type as UnsubscribableType };
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', `notifications-unsubscribe:${secret}`)
    .update(payload)
    .digest('base64url');
}
