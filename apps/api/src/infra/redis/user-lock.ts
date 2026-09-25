import { randomUUID } from 'node:crypto';

import type { RedisService } from './redis.service';

/**
 * Trava por chave, usada para processar eventos de um mesmo aluno em ordem
 * sem depender do agrupamento de fila pago do BullMQ (ver learner-model e
 * srs). `SET NX PX` com token; a liberação confere o token antes de apagar,
 * porque a trava pode ter expirado e sido pega por outro worker.
 */

const RELEASE_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

export type LockOutcome<T> =
  { status: 'LOCKED' } | { status: 'DONE'; result: T };

export async function withLock<T>(
  redis: RedisService,
  key: string,
  ttlMs: number,
  work: () => Promise<T>,
): Promise<LockOutcome<T>> {
  const token = randomUUID();
  const acquired = await redis.client.set(key, token, 'PX', ttlMs, 'NX');

  if (acquired === null) {
    return { status: 'LOCKED' };
  }

  try {
    return { status: 'DONE', result: await work() };
  } finally {
    await redis.client.eval(RELEASE_LOCK, 1, key, token);
  }
}
