import type {
  GenerationJob,
  GenerationStep,
  StepStatus,
} from '@english-saas/api-client';

export type PhaseStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type JobPhase = { key: string; label: string; status: PhaseStatus };

type PhaseDef = { key: string; label: string; steps: GenerationStep[] };

/**
 * As etapas do back-end agrupadas nas quatro fases que o aluno vê. A ordem
 * das etapas é monotônica dentro de cada tipo de pedido, então as fases
 * também andam sempre para a frente.
 */
const TOPIC_PHASES: PhaseDef[] = [
  { key: 'understand', label: 'Entendendo o tema', steps: ['SUGGEST'] },
  { key: 'source', label: 'Buscando a fonte', steps: ['FETCH_SOURCE'] },
  {
    key: 'write',
    label: 'Escrevendo no seu nível',
    steps: ['PICK_TARGETS', 'GENERATE'],
  },
  {
    key: 'check',
    label: 'Conferindo os fatos',
    steps: ['VALIDATE', 'EXERCISES', 'DELIVER'],
  },
];

const INGEST_PHASES: PhaseDef[] = [
  { key: 'read', label: 'Lendo seu conteúdo', steps: ['INGEST_SOURCE'] },
  { key: 'understand', label: 'Entendendo o texto', steps: ['ANALYZE'] },
  {
    key: 'write',
    label: 'Escrevendo no seu nível',
    steps: ['PICK_TARGETS', 'GENERATE'],
  },
  {
    key: 'check',
    label: 'Conferindo os fatos',
    steps: ['VALIDATE', 'EXERCISES', 'DELIVER'],
  },
];

function phaseStatus(
  statuses: StepStatus[],
  previousDone: boolean,
): PhaseStatus {
  if (statuses.includes('FAILED')) return 'FAILED';
  // Fase sem etapa neste pedido (tema escolhido, sem "surpreenda-me", não
  // tem SUGGEST): conta como feita assim que a anterior terminou.
  if (statuses.length === 0) return previousDone ? 'DONE' : 'PENDING';
  if (statuses.every((status) => status === 'DONE')) return 'DONE';
  if (statuses.some((status) => status !== 'PENDING')) return 'RUNNING';
  return 'PENDING';
}

/** Pedido de sugestões não tem fases — só os de material. */
export function toJobPhases(job: GenerationJob): JobPhase[] {
  if (job.kind === 'SUGGEST') {
    return [];
  }

  const defs = job.kind === 'INGEST' ? INGEST_PHASES : TOPIC_PHASES;
  const byStep = new Map(job.steps.map((state) => [state.step, state.status]));
  const phases: JobPhase[] = [];
  let previousDone = true;

  for (const def of defs) {
    const statuses = def.steps.flatMap((step) => {
      const status = byStep.get(step);
      return status === undefined ? [] : [status];
    });
    const status = phaseStatus(statuses, previousDone);

    phases.push({ key: def.key, label: def.label, status });
    previousDone = status === 'DONE';
  }

  return phases;
}
