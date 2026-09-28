import { ApiError } from './api-error';

export type RunResult<TResult> =
  { status: 'done'; result: TResult } | { status: 'queued' };

export type OfflineQueue<TAction, TResult = void> = {
  /** Executa agora; se a rede caiu (`NETWORK_ERROR`), enfileira para depois. */
  run: (action: TAction) => Promise<RunResult<TResult>>;
  /** Reexecuta o que está na fila, na ordem. Some da fila o que já foi feito. */
  flush: () => Promise<void>;
  size: () => number;
  stop: () => void;
};

/**
 * Fila de ações idempotentes que falharam por rede, persistida em
 * `localStorage` (sobrevive a fechar a aba) e reexecutada quando a conexão
 * volta. Feita para `completeStep`/`answers` do player da lição — os dois
 * são "repetir é inofensivo" no back-end, então reexecutar sem perguntar ao
 * aluno é seguro. Qualquer erro que não seja de rede (plano expirado, etapa
 * que já não existe) é descartado da fila: reexecutar não resolveria.
 */
export function createOfflineQueue<TAction, TResult = void>(options: {
  storageKey: string;
  execute: (action: TAction) => Promise<TResult>;
}): OfflineQueue<TAction, TResult> {
  const { storageKey, execute } = options;
  let pending: TAction[] = load(storageKey);
  let flushing = false;

  function persist(): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pending));
    } catch {
      // Sem storage disponível (privado, cota cheia): a fila some ao
      // recarregar, mas a sessão atual continua funcionando.
    }
  }

  function enqueue(action: TAction): void {
    pending = [...pending, action];
    persist();
  }

  async function run(action: TAction): Promise<RunResult<TResult>> {
    try {
      const result = await execute(action);
      return { status: 'done', result };
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
        enqueue(action);
        return { status: 'queued' };
      }

      throw error;
    }
  }

  async function flush(): Promise<void> {
    if (flushing) {
      return;
    }

    flushing = true;

    try {
      while (pending.length > 0) {
        const [next, ...rest] = pending;

        try {
          await execute(next as TAction);
        } catch (error) {
          if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
            // Ainda offline: para aqui, mantém a fila como está.
            return;
          }
          // Erro definitivo (não é de rede): descarta e segue para o resto.
        }

        pending = rest;
        persist();
      }
    } finally {
      flushing = false;
    }
  }

  function onOnline(): void {
    void flush();
  }

  window.addEventListener('online', onOnline);

  return {
    run,
    flush,
    size: () => pending.length,
    stop: () => window.removeEventListener('online', onOnline),
  };
}

function load<TAction>(storageKey: string): TAction[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TAction[]) : [];
  } catch {
    return [];
  }
}
