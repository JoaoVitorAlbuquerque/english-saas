import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, networkApiError } from './api-error';
import { createOfflineQueue } from './offline-queue';

const KEY = 'test:offline-queue';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('createOfflineQueue', () => {
  it('roda a ação na hora quando dá certo, sem enfileirar', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    const result = await queue.run({ id: 1 });

    expect(result).toEqual({ status: 'done' });
    expect(execute).toHaveBeenCalledWith({ id: 1 });
    expect(queue.size()).toBe(0);
    queue.stop();
  });

  it('enfileira quando a chamada falha por NETWORK_ERROR', async () => {
    const execute = vi.fn().mockRejectedValue(networkApiError());
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    const result = await queue.run({ id: 1 });

    expect(result).toEqual({ status: 'queued' });
    expect(queue.size()).toBe(1);
    queue.stop();
  });

  it('não enfileira em erro que não é de rede — propaga para quem chamou', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ code: 'PLAN_REQUIRED', message: 'x', status: 403 }),
      );
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    await expect(queue.run({ id: 1 })).rejects.toMatchObject({
      code: 'PLAN_REQUIRED',
    });
    expect(queue.size()).toBe(0);
    queue.stop();
  });

  it('esvazia a fila ao voltar online', async () => {
    const execute = vi.fn().mockRejectedValueOnce(networkApiError());
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    await queue.run({ id: 1 });
    expect(queue.size()).toBe(1);

    execute.mockResolvedValue(undefined);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(queue.size()).toBe(0));
    expect(execute).toHaveBeenLastCalledWith({ id: 1 });
    queue.stop();
  });

  it('flush para no primeiro erro de rede e mantém o resto na fila', async () => {
    const execute = vi.fn().mockRejectedValue(networkApiError());
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    await queue.run({ id: 1 });
    await queue.run({ id: 2 });
    expect(queue.size()).toBe(2);

    await queue.flush();

    expect(queue.size()).toBe(2);
    queue.stop();
  });

  it('descarta uma ação que falha por um erro que não é de rede, e segue as outras', async () => {
    const execute = vi.fn().mockRejectedValue(networkApiError());
    const queue = createOfflineQueue({ storageKey: KEY, execute });

    await queue.run({ id: 1 });
    await queue.run({ id: 2 });

    execute.mockReset();
    execute
      .mockRejectedValueOnce(
        new ApiError({ code: 'NOT_FOUND', message: 'x', status: 404 }),
      )
      .mockResolvedValueOnce(undefined);

    await queue.flush();

    expect(queue.size()).toBe(0);
    expect(execute).toHaveBeenCalledTimes(2);
    queue.stop();
  });

  it('persiste entre instâncias com a mesma storageKey', async () => {
    const execute = vi.fn().mockRejectedValue(networkApiError());
    const first = createOfflineQueue({ storageKey: KEY, execute });
    await first.run({ id: 1 });
    first.stop();

    const second = createOfflineQueue({ storageKey: KEY, execute });
    expect(second.size()).toBe(1);
    second.stop();
  });
});
