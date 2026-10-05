/**
 * Máquina do salvamento automático — pura, sem relógio nem rede.
 *
 *   clean ──edited──▶ dirty ──save-started──▶ saving ──save-succeeded──▶ saved
 *                       ▲                        │                         │
 *                       └──────── edited ────────┤ (na fila)       edited ─┘
 *                                           save-failed
 *                                                ▼
 *                                              error ──(nova tentativa)──▶ saving
 *
 * Edição que chega **durante** um salvamento não abre um segundo pedido: a
 * máquina marca `queued` e, ao terminar, volta para `dirty` — o próximo
 * salvamento leva tudo junto. Nunca há dois pedidos em voo.
 */

export type AutosaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export type AutosaveState = {
  status: AutosaveStatus;
  /** Houve edição enquanto salvava. */
  queued: boolean;
  /** Instante (ms) do último salvamento que deu certo. */
  savedAt: number | null;
  /** Falhas seguidas, desde o último sucesso. */
  retries: number;
  errorMessage: string | null;
};

export type AutosaveEvent =
  | { type: 'edited' }
  | { type: 'save-started' }
  | { type: 'save-succeeded'; at: number }
  | { type: 'save-failed'; message: string };

export const INITIAL_AUTOSAVE: AutosaveState = {
  status: 'clean',
  queued: false,
  savedAt: null,
  retries: 0,
  errorMessage: null,
};

/** Quanto espera depois da última edição antes de salvar. */
export const AUTOSAVE_DEBOUNCE_MS = 1_500;
/** Depois de tantas falhas seguidas, só o botão "tentar de novo" salva. */
export const MAX_AUTO_RETRIES = 3;

export function reduceAutosave(
  state: AutosaveState,
  event: AutosaveEvent,
): AutosaveState {
  switch (event.type) {
    case 'edited':
      if (state.status === 'saving') {
        return { ...state, queued: true };
      }

      return { ...state, status: 'dirty', errorMessage: null };

    case 'save-started':
      return state.status === 'dirty' || state.status === 'error'
        ? { ...state, status: 'saving', queued: false, errorMessage: null }
        : state;

    case 'save-succeeded':
      if (state.status !== 'saving') {
        return state;
      }

      return {
        status: state.queued ? 'dirty' : 'saved',
        queued: false,
        savedAt: event.at,
        retries: 0,
        errorMessage: null,
      };

    case 'save-failed':
      if (state.status !== 'saving') {
        return state;
      }

      return {
        ...state,
        status: 'error',
        queued: false,
        retries: state.retries + 1,
        errorMessage: event.message,
      };
  }
}

/** Dá para começar um salvamento agora. */
export function canSave(state: AutosaveState): boolean {
  return state.status === 'dirty' || state.status === 'error';
}

/** Espera entre uma falha e a nova tentativa automática: 2 s, 4 s, 8 s. */
export function retryDelayMs(retries: number): number {
  return 2_000 * 2 ** Math.max(retries - 1, 0);
}

/**
 * Quanto tempo falta para o próximo salvamento automático, ou `null` quando
 * não há nada agendado (limpo, salvando, ou esgotou as tentativas).
 */
export function nextSaveDelayMs(
  state: AutosaveState,
  debounceMs = AUTOSAVE_DEBOUNCE_MS,
): number | null {
  if (state.status === 'dirty') {
    return state.retries > 0 ? retryDelayMs(state.retries) : debounceMs;
  }

  if (state.status === 'error' && state.retries <= MAX_AUTO_RETRIES) {
    return retryDelayMs(state.retries);
  }

  return null;
}

/** Há trabalho que ainda não está no servidor: vale avisar antes de sair. */
export function hasUnsavedWork(state: AutosaveState): boolean {
  return (
    state.status === 'dirty' ||
    state.status === 'saving' ||
    state.status === 'error'
  );
}
