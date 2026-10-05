import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOSAVE_DEBOUNCE_MS, retryDelayMs } from './autosave-machine';
import { useAutosave } from './useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

type Props = { snapshot: string; enabled?: boolean };

function setup(save: (snapshot: string) => Promise<void>) {
  return renderHook(
    ({ snapshot, enabled = true }: Props) =>
      useAutosave({
        snapshot,
        initialSnapshot: 'v0',
        enabled,
        save,
        now: () => 1_000,
      }),
    { initialProps: { snapshot: 'v0' } as Props },
  );
}

describe('useAutosave', () => {
  it('sem edição, não salva nada', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = setup(save);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 3);
    });

    expect(save).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('clean');
  });

  it('edições seguidas viram um salvamento só, depois do debounce', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });
    expect(result.current.state.status).toBe('dirty');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 200);
    });
    rerender({ snapshot: 'v2' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 200);
    });

    // O segundo `rerender` reiniciou a espera: ainda não salvou.
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('v2');
    expect(result.current.state).toMatchObject({
      status: 'saved',
      savedAt: 1_000,
    });
  });

  it('passa por "salvando" enquanto o pedido está em voo', async () => {
    let finish: () => void = () => undefined;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });

    expect(result.current.state.status).toBe('saving');

    await act(async () => {
      finish();
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('saved');
  });

  it('editar durante o salvamento não abre outro pedido: salva de novo depois', async () => {
    const resolvers: (() => void)[] = [];
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ snapshot: 'v2' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
    });

    // Ainda com o primeiro em voo: nada de segundo pedido.
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]?.();
      await Promise.resolve();
    });
    expect(result.current.state.status).toBe('dirty');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('v2');
  });

  it('falha vira erro e tenta de novo sozinho, com espera', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });

    expect(result.current.state).toMatchObject({
      status: 'error',
      errorMessage: 'sem rede',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(retryDelayMs(1));
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('saved');
  });

  it('o botão "tentar de novo" salva sem esperar a espera', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(result.current.state.status).toBe('error');

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('saved');
  });

  it('flush salva na hora o que está pendente', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1' });

    await act(async () => {
      await result.current.flush();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('saved');
  });

  it('desligado (versão publicada), nunca salva', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ snapshot: 'v1', enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 3);
      await result.current.flush();
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('avisa antes de sair enquanto há alteração solta', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = setup(save);

    rerender({ snapshot: 'v1' });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });

    const later = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(later);

    expect(later.defaultPrevented).toBe(false);
  });
});
