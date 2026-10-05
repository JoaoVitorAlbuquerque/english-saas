import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  AUTOSAVE_DEBOUNCE_MS,
  INITIAL_AUTOSAVE,
  canSave,
  hasUnsavedWork,
  nextSaveDelayMs,
  reduceAutosave,
  type AutosaveState,
} from './autosave-machine';

export type UseAutosaveOptions = {
  /** Texto que muda quando o conteúdo muda (ver `stepsSnapshot`). */
  snapshot: string;
  /** O conteúdo que o servidor já tem, ao abrir. */
  initialSnapshot: string;
  /** Falso em versão publicada ou arquivada: nada se salva. */
  enabled: boolean;
  /** Grava o conteúdo. Lança se não conseguir. */
  save: (snapshot: string) => Promise<void>;
  debounceMs?: number;
  now?: () => number;
};

export type UseAutosave = {
  state: AutosaveState;
  /** Salva já, sem esperar o debounce, e espera terminar. */
  flush: () => Promise<void>;
  /** O botão "tentar de novo". */
  retry: () => void;
};

/**
 * Salvamento automático do rascunho: debounce depois da última edição, um
 * pedido por vez, repete com espera crescente se a rede falhar e avisa antes
 * de a pessoa sair com alteração solta.
 *
 * `save` recebe o `snapshot` que está sendo gravado; o hook só considera o
 * conteúdo salvo depois que ele volta com sucesso. Se a pessoa continuou
 * digitando nesse meio-tempo, o snapshot atual já é outro e a máquina agenda
 * mais um salvamento.
 */
export function useAutosave({
  snapshot,
  initialSnapshot,
  enabled,
  save,
  debounceMs = AUTOSAVE_DEBOUNCE_MS,
  now = Date.now,
}: UseAutosaveOptions): UseAutosave {
  const [state, dispatch] = useReducer(reduceAutosave, INITIAL_AUTOSAVE);
  const savedRef = useRef(initialSnapshot);
  const latestRef = useRef(snapshot);
  const saveRef = useRef(save);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const stateRef = useRef(state);

  latestRef.current = snapshot;
  saveRef.current = save;
  stateRef.current = state;

  // Quando o servidor entrega outro conteúdo de base (a versão carregou), o
  // que "está salvo" é isso.
  useEffect(() => {
    savedRef.current = initialSnapshot;
  }, [initialSnapshot]);

  useEffect(() => {
    if (enabled && snapshot !== savedRef.current) {
      dispatch({ type: 'edited' });
    }
  }, [snapshot, enabled]);

  const run = useCallback((): Promise<void> => {
    if (inFlightRef.current !== null) {
      return inFlightRef.current;
    }

    if (!canSave(stateRef.current)) {
      return Promise.resolve();
    }

    const target = latestRef.current;

    dispatch({ type: 'save-started' });
    // A máquina só sai de `dirty`/`error` ao receber o evento; o ref segue
    // na frente do próximo render para dois `run` seguidos não se atropelarem.
    stateRef.current = { ...stateRef.current, status: 'saving' };

    const promise = saveRef
      .current(target)
      .then(() => {
        savedRef.current = target;
        dispatch({ type: 'save-succeeded', at: now() });
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'save-failed',
          message: error instanceof Error ? error.message : 'Falha ao salvar.',
        });
      })
      .finally(() => {
        inFlightRef.current = null;
      });

    inFlightRef.current = promise;

    return promise;
  }, [now]);

  const delay = enabled ? nextSaveDelayMs(state, debounceMs) : null;

  useEffect(() => {
    if (delay === null) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void run();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, state.status, state.retries, snapshot, run]);

  useEffect(() => {
    if (!hasUnsavedWork(state)) {
      return undefined;
    }

    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const flush = useCallback(async (): Promise<void> => {
    // Espera o que está em voo; se a pessoa digitou mais, salva de novo.
    for (let round = 0; round < 3; round += 1) {
      if (inFlightRef.current !== null) {
        await inFlightRef.current;
      }

      if (
        !canSave(stateRef.current) &&
        latestRef.current === savedRef.current
      ) {
        return;
      }

      if (!enabled) {
        return;
      }

      if (latestRef.current === savedRef.current) {
        return;
      }

      // `edited` pode ainda não ter virado `dirty` (efeito pendente).
      if (!canSave(stateRef.current)) {
        dispatch({ type: 'edited' });
        stateRef.current = reduceAutosave(stateRef.current, { type: 'edited' });
      }

      await run();
    }
  }, [enabled, run]);

  const retry = useCallback(() => {
    void run();
  }, [run]);

  return { state, flush, retry };
}
