import {
  INITIAL_DIFFICULTY_BY_LEVEL,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  type CefrLevel,
} from '@english-saas/shared';

/**
 * Habilidade do aluno numa skill.
 *
 * `theta` está na **mesma escala logit da dificuldade do item**: theta igual
 * à dificuldade = 50% de chance de acerto. A atualização é do tipo Elo —
 * cada resposta puxa o theta na direção do resultado, proporcional à
 * surpresa (`score - p`).
 *
 * O passo `K` começa grande e diminui com a evidência: nas primeiras
 * respostas o modelo aprende rápido, depois estabiliza. O piso de 0.1
 * mantém o modelo acompanhando quem melhora — e custa precisão: com K
 * estável em 0.1, o theta flutua com desvio de uns 0.2 logit em torno do
 * valor verdadeiro. É o preço de não congelar.
 */

export const MASTERY_CONFIG = {
  kBase: 0.8,
  kDecay: 0.15,
  kMin: 0.1,
  /** Resposta com dica vale 70%. */
  hintFactor: 0.7,
  /** Skill principal do item pesa 1; as outras, metade. */
  primaryWeight: 1,
  secondaryWeight: 0.5,
  /** Decaimento só na leitura: carência, depois uma perda lenta com teto. */
  decayGraceDays: 14,
  decayPerDay: 0.01,
  decayMax: 0.5,
} as const;

const DAY_MS = 86_400_000;

export type SkillState = {
  theta: number;
  evidenceCount: number;
  correctStreak: number;
  lastPracticedAt: Date | null;
};

export type AnswerSignal = {
  difficulty: number;
  /** 0–1, já corrigido pelo learning. */
  score: number;
  isCorrect: boolean;
  hintsUsed: number;
  /** 1 para a skill principal do item, 0.5 para as secundárias. */
  weight: number;
  at: Date;
};

/** Dificuldade típica de um item do nível — o "meio" do nível. */
export function typicalDifficulty(level: CefrLevel): number {
  return INITIAL_DIFFICULTY_BY_LEVEL[level];
}

/** p = 1 / (1 + e^-(theta - dificuldade)). */
export function probabilityCorrect(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(theta - difficulty)));
}

/** K = max(0.1, 0.8 / (1 + 0.15 · evidências)). */
export function learningRate(evidenceCount: number): number {
  return Math.max(
    MASTERY_CONFIG.kMin,
    MASTERY_CONFIG.kBase / (1 + MASTERY_CONFIG.kDecay * evidenceCount),
  );
}

/**
 * O score que entra na conta.
 *
 * Com dica, vale 70%. Resposta muito rápida e errada **conta normal**: o
 * aluno que chuta errado está mostrando que não sabe, e descontar isso
 * inflaria o theta de quem clica sem ler.
 */
export function effectiveScore(score: number, hintsUsed: number): number {
  const clamped = Math.min(1, Math.max(0, score));
  return hintsUsed > 0 ? clamped * MASTERY_CONFIG.hintFactor : clamped;
}

/** Peso da skill no item: a primeira da lista é a principal. */
export function skillWeight(position: number): number {
  return position === 0
    ? MASTERY_CONFIG.primaryWeight
    : MASTERY_CONFIG.secondaryWeight;
}

/**
 * Ponto de partida de uma skill nunca praticada.
 *
 * Com nivelamento (8), é o theta da competência que ele mediu — um aluno
 * B1 não começa uma skill A1 do zero. Sem nivelamento, a dificuldade
 * típica do nível da skill: a mastery começa em 0.5 — "não sei" — e não em
 * 0.88 para uma skill A1 só porque theta 0 é B1.
 */
export function initialSkillState(
  level: CefrLevel,
  priorTheta?: number,
): SkillState {
  return {
    theta: priorTheta ?? typicalDifficulty(level),
    evidenceCount: 0,
    correctStreak: 0,
    lastPracticedAt: null,
  };
}

/** theta += peso · K · (score − p). */
export function applyAnswer(
  state: SkillState,
  signal: AnswerSignal,
): SkillState {
  const p = probabilityCorrect(state.theta, signal.difficulty);
  const k = learningRate(state.evidenceCount);
  const score = effectiveScore(signal.score, signal.hintsUsed);

  return {
    theta: clampTheta(state.theta + signal.weight * k * (score - p)),
    evidenceCount: state.evidenceCount + signal.weight,
    correctStreak: signal.isCorrect ? state.correctStreak + 1 : 0,
    lastPracticedAt: signal.at,
  };
}

/**
 * Theta na hora da leitura: cai devagar depois de duas semanas sem prática.
 * O banco guarda o theta sem decaimento; a revisão espaçada (9) cuida de
 * trazer a skill de volta.
 */
export function decayedTheta(state: SkillState, now: Date): number {
  if (state.lastPracticedAt === null) {
    return state.theta;
  }

  const idleDays = (now.getTime() - state.lastPracticedAt.getTime()) / DAY_MS;
  const decayDays = idleDays - MASTERY_CONFIG.decayGraceDays;

  if (decayDays <= 0) {
    return state.theta;
  }

  return (
    state.theta -
    Math.min(MASTERY_CONFIG.decayMax, decayDays * MASTERY_CONFIG.decayPerDay)
  );
}

/**
 * Mastery 0–1: a chance de acertar um item de dificuldade típica do nível
 * da skill, com o decaimento aplicado.
 */
export function masteryOf(
  state: SkillState,
  skillLevel: CefrLevel,
  now: Date,
): number {
  return probabilityCorrect(
    decayedTheta(state, now),
    typicalDifficulty(skillLevel),
  );
}

function clampTheta(value: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, value));
}
