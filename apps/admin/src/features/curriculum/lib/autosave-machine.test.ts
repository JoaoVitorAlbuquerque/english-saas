import { describe, expect, it } from 'vitest';

import {
  AUTOSAVE_DEBOUNCE_MS,
  INITIAL_AUTOSAVE,
  MAX_AUTO_RETRIES,
  canSave,
  hasUnsavedWork,
  nextSaveDelayMs,
  reduceAutosave,
  retryDelayMs,
  type AutosaveEvent,
  type AutosaveState,
} from './autosave-machine';

function run(events: AutosaveEvent[], from = INITIAL_AUTOSAVE): AutosaveState {
  return events.reduce(reduceAutosave, from);
}

const FAIL: AutosaveEvent = { type: 'save-failed', message: 'x' };

describe('reduceAutosave', () => {
  it('começa limpo; editar deixa sujo; salvar vira "salvo"', () => {
    expect(INITIAL_AUTOSAVE.status).toBe('clean');

    const edited = run([{ type: 'edited' }]);
    expect(edited.status).toBe('dirty');

    const saving = reduceAutosave(edited, { type: 'save-started' });
    expect(saving.status).toBe('saving');

    const saved = reduceAutosave(saving, { type: 'save-succeeded', at: 1_000 });
    expect(saved).toMatchObject({
      status: 'saved',
      savedAt: 1_000,
      retries: 0,
    });
  });

  it('edição durante o salvamento fica na fila e volta a sujo no fim', () => {
    const state = run([
      { type: 'edited' },
      { type: 'save-started' },
      { type: 'edited' },
    ]);

    expect(state).toMatchObject({ status: 'saving', queued: true });

    const done = reduceAutosave(state, { type: 'save-succeeded', at: 5 });

    expect(done).toMatchObject({ status: 'dirty', queued: false, savedAt: 5 });
  });

  it('falha vira erro, conta a tentativa e guarda a mensagem', () => {
    const state = run([
      { type: 'edited' },
      { type: 'save-started' },
      { type: 'save-failed', message: 'sem rede' },
    ]);

    expect(state).toMatchObject({
      status: 'error',
      retries: 1,
      errorMessage: 'sem rede',
    });
    expect(canSave(state)).toBe(true);
  });

  it('nova tentativa a partir do erro; sucesso zera as falhas', () => {
    const failed = run([{ type: 'edited' }, { type: 'save-started' }, FAIL]);
    const retried = run(
      [{ type: 'save-started' }, { type: 'save-succeeded', at: 9 }],
      failed,
    );

    expect(retried).toMatchObject({
      status: 'saved',
      retries: 0,
      errorMessage: null,
    });
  });

  it('editar depois de um erro volta a sujo, sem perder a conta de falhas', () => {
    const failed = run([{ type: 'edited' }, { type: 'save-started' }, FAIL]);

    expect(reduceAutosave(failed, { type: 'edited' })).toMatchObject({
      status: 'dirty',
      retries: 1,
      errorMessage: null,
    });
  });

  it('eventos fora de hora são ignorados', () => {
    expect(
      reduceAutosave(INITIAL_AUTOSAVE, { type: 'save-succeeded', at: 1 }),
    ).toBe(INITIAL_AUTOSAVE);
    expect(reduceAutosave(INITIAL_AUTOSAVE, { type: 'save-started' })).toBe(
      INITIAL_AUTOSAVE,
    );
    expect(reduceAutosave(INITIAL_AUTOSAVE, FAIL)).toBe(INITIAL_AUTOSAVE);
  });

  it('depois de salvo, editar volta a sujo', () => {
    const saved = run([
      { type: 'edited' },
      { type: 'save-started' },
      { type: 'save-succeeded', at: 1 },
    ]);

    expect(reduceAutosave(saved, { type: 'edited' }).status).toBe('dirty');
  });
});

describe('agendamento', () => {
  it('sujo espera o debounce; limpo, salvo e salvando não agendam nada', () => {
    const dirty = run([{ type: 'edited' }]);
    const saving = run([{ type: 'edited' }, { type: 'save-started' }]);

    expect(nextSaveDelayMs(dirty)).toBe(AUTOSAVE_DEBOUNCE_MS);
    expect(nextSaveDelayMs(INITIAL_AUTOSAVE)).toBeNull();
    expect(nextSaveDelayMs(saving)).toBeNull();
  });

  it('erro tenta de novo com espera crescente e para depois do teto', () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(3)).toBe(8_000);

    let state: AutosaveState = run([{ type: 'edited' }]);

    for (let attempt = 1; attempt <= MAX_AUTO_RETRIES; attempt += 1) {
      state = run([{ type: 'save-started' }, FAIL], state);

      expect(nextSaveDelayMs(state)).toBe(retryDelayMs(attempt));
    }

    state = run([{ type: 'save-started' }, FAIL], state);

    expect(nextSaveDelayMs(state)).toBeNull();
    expect(canSave(state)).toBe(true);
  });

  it('só avisa antes de sair quando há trabalho fora do servidor', () => {
    expect(hasUnsavedWork(INITIAL_AUTOSAVE)).toBe(false);
    expect(hasUnsavedWork(run([{ type: 'edited' }]))).toBe(true);
    expect(
      hasUnsavedWork(
        run([
          { type: 'edited' },
          { type: 'save-started' },
          { type: 'save-succeeded', at: 1 },
        ]),
      ),
    ).toBe(false);
  });
});
