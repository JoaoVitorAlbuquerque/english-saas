/**
 * As etapas de um pedido ao generator, na ordem, com o status de cada uma —
 * é o que o app mostra enquanto o material é montado.
 */

export const GENERATION_STEPS = [
  'SUGGEST',
  'INGEST_SOURCE',
  'ANALYZE',
  'FETCH_SOURCE',
  'PICK_TARGETS',
  'GENERATE',
  'VALIDATE',
  'EXERCISES',
  'DELIVER',
] as const;

export type GenerationStep = (typeof GENERATION_STEPS)[number];

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type StepState = {
  step: GenerationStep;
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
};

/** O que o aluno vê em cada etapa. */
export const STEP_LABELS: Record<GenerationStep, string> = {
  SUGGEST: 'Pensando em assuntos para você',
  INGEST_SOURCE: 'Lendo o conteúdo que você mandou',
  ANALYZE: 'Entendendo o texto',
  FETCH_SOURCE: 'Buscando a fonte',
  PICK_TARGETS: 'Escolhendo o que você vai praticar',
  GENERATE: 'Escrevendo o texto no seu nível',
  VALIDATE: 'Conferindo fatos e nível',
  EXERCISES: 'Montando os exercícios',
  DELIVER: 'Finalizando',
};

const MATERIAL_STEPS: GenerationStep[] = [
  'PICK_TARGETS',
  'GENERATE',
  'VALIDATE',
  'EXERCISES',
  'DELIVER',
];

export function stepsFor(
  kind: 'SUGGEST' | 'TOPIC' | 'INGEST',
  options: { surprise?: boolean } = {},
): GenerationStep[] {
  switch (kind) {
    case 'SUGGEST':
      return ['SUGGEST'];
    case 'TOPIC':
      return [
        ...(options.surprise === true ? (['SUGGEST'] as const) : []),
        'FETCH_SOURCE',
        ...MATERIAL_STEPS,
      ];
    case 'INGEST':
      return ['INGEST_SOURCE', 'ANALYZE', ...MATERIAL_STEPS];
  }
}

export function initialSteps(steps: readonly GenerationStep[]): StepState[] {
  return steps.map((step) => ({
    step,
    status: 'PENDING',
    startedAt: null,
    finishedAt: null,
  }));
}

/** Nova lista com a etapa no status dado. Etapa fora da lista: sem mudança. */
export function markStep(
  steps: readonly StepState[],
  step: GenerationStep,
  status: StepStatus,
  at: Date,
): StepState[] {
  return steps.map((state) => {
    if (state.step !== step) {
      return state;
    }

    return {
      step,
      status,
      startedAt:
        status === 'RUNNING' ? at.toISOString() : (state.startedAt ?? null),
      finishedAt:
        status === 'DONE' || status === 'FAILED' ? at.toISOString() : null,
    };
  });
}

/** A etapa já terminou numa tentativa anterior? (O retry pula.) */
export function isDone(
  steps: readonly StepState[],
  step: GenerationStep,
): boolean {
  return steps.some((state) => state.step === step && state.status === 'DONE');
}

/** A etapa que estava rodando quando o job desistiu vira FAILED. */
export function failRunning(
  steps: readonly StepState[],
  at: Date,
): StepState[] {
  return steps.map((state) =>
    state.status === 'RUNNING'
      ? { ...state, status: 'FAILED', finishedAt: at.toISOString() }
      : state,
  );
}
