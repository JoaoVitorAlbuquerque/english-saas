import {
  CEFR_LEVELS,
  LEARNING_GOAL_LABELS,
  type AvailabilityMinutes,
  type CefrLevel,
  type LearningGoal,
  type Weekday,
} from '@english-saas/shared';

/**
 * Monta a trilha de lições até o nível-alvo.
 *
 * Parte do nível de partida, pula o que já está dominado, prioriza unidade
 * ligada ao objetivo do aluno dentro do mesmo nível (sem furar pré-requisito
 * de skill) e estima quando o aluno chega lá no ritmo dele.
 */

export const MASTERY_THRESHOLD = 0.8;

export type CourseLesson = {
  lessonId: string;
  unitId: string;
  title: string;
  cefrLevel: CefrLevel;
  estimatedMinutes: number;
  targetSkillIds: string[];
};

export type SkillNode = {
  id: string;
  cefrLevel: CefrLevel;
  goals: LearningGoal[];
  prerequisiteIds: string[];
};

export type MasteryBySkill = ReadonlyMap<
  string,
  { mastery: number; evidence: number }
>;

export type PathEntry = {
  lessonId: string;
  unitId: string;
  title: string;
  cefrLevel: CefrLevel;
  estimatedMinutes: number;
  order: number;
  reason: string;
};

export type PlanForecast = {
  /** ISO date (`YYYY-MM-DD`), ou `null` se não houver nenhum dia de estudo. */
  estimatedArrival: string | null;
  weeksNeeded: number | null;
  realistic: boolean;
  message: string | null;
};

export type BuildPathResult = {
  path: PathEntry[];
  reinforceSkillIds: string[];
  forecast: PlanForecast;
};

const WEEKDAY_INDEX: Weekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];
/** Não deixa o forecast rodar pra sempre quando a disponibilidade é toda zero. */
const MAX_FORECAST_DAYS = 5 * 365;

function levelIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

function isMastered(
  skillIds: readonly string[],
  mastery: MasteryBySkill,
): boolean {
  return (
    skillIds.length > 0 &&
    skillIds.every((id) => (mastery.get(id)?.mastery ?? 0) >= MASTERY_THRESHOLD)
  );
}

/** Quantas target skills da lição batem um objetivo do aluno. */
function goalScoreOf(
  targetSkillIds: readonly string[],
  skillGraph: ReadonlyMap<string, SkillNode>,
  goals: ReadonlySet<LearningGoal>,
): number {
  let score = 0;

  for (const skillId of targetSkillIds) {
    const node = skillGraph.get(skillId);
    if (node === undefined || node.goals.length === 0) continue;
    if (node.goals.some((goal) => goals.has(goal))) score += 1;
  }

  return score;
}

/** O primeiro objetivo do aluno que alguma target skill da lição atende. */
function matchedGoal(
  targetSkillIds: readonly string[],
  skillGraph: ReadonlyMap<string, SkillNode>,
  goals: ReadonlySet<LearningGoal>,
): LearningGoal | null {
  for (const skillId of targetSkillIds) {
    const node = skillGraph.get(skillId);
    const hit = node?.goals.find((goal) => goals.has(goal));
    if (hit !== undefined) return hit;
  }

  return null;
}

/**
 * Promove lições de unidade ligada ao objetivo pra frente, dentro do mesmo
 * nível — sem passar por cima de quem ensina um pré-requisito de uma skill
 * dela. Troca adjacente, um passo por vez: simples de explicar e de testar.
 */
function prioritizeByGoal(
  lessons: readonly CourseLesson[],
  skillGraph: ReadonlyMap<string, SkillNode>,
  goals: ReadonlySet<LearningGoal>,
): CourseLesson[] {
  const result = [...lessons];

  const scoreOf = (lesson: CourseLesson) =>
    goalScoreOf(lesson.targetSkillIds, skillGraph, goals);

  const teachesPrerequisiteOf = (
    earlier: CourseLesson,
    later: CourseLesson,
  ): boolean => {
    const prereqIds = new Set(
      later.targetSkillIds.flatMap(
        (id) => skillGraph.get(id)?.prerequisiteIds ?? [],
      ),
    );
    return earlier.targetSkillIds.some((id) => prereqIds.has(id));
  };

  for (let i = 1; i < result.length; i += 1) {
    let j = i;

    while (j > 0) {
      const current = result[j];
      const previous = result[j - 1];
      if (current === undefined || previous === undefined) break;
      if (current.cefrLevel !== previous.cefrLevel) break;
      if (scoreOf(current) <= scoreOf(previous)) break;
      if (teachesPrerequisiteOf(previous, current)) break;

      result[j] = previous;
      result[j - 1] = current;
      j -= 1;
    }
  }

  return result;
}

function reasonFor(
  lesson: CourseLesson,
  skillGraph: ReadonlyMap<string, SkillNode>,
  goals: ReadonlySet<LearningGoal>,
): string {
  const goal = matchedGoal(lesson.targetSkillIds, skillGraph, goals);
  return goal === null
    ? 'Próxima da sua trilha.'
    : `Alinhado ao seu objetivo: ${LEARNING_GOAL_LABELS[goal]}.`;
}

function forecastOf(
  remainingMinutes: number,
  availabilityMinutes: AvailabilityMinutes,
  targetLevel: CefrLevel,
  targetDate: Date | null,
  now: Date,
): PlanForecast {
  if (remainingMinutes === 0) {
    return {
      estimatedArrival: now.toISOString().slice(0, 10),
      weeksNeeded: 0,
      realistic: true,
      message: null,
    };
  }

  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  let accumulated = 0;
  let days = 0;

  while (accumulated < remainingMinutes && days < MAX_FORECAST_DAYS) {
    const weekday = WEEKDAY_INDEX[cursor.getUTCDay()];
    accumulated += weekday === undefined ? 0 : availabilityMinutes[weekday];
    days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (accumulated < remainingMinutes) {
    return {
      estimatedArrival: null,
      weeksNeeded: null,
      realistic: false,
      message:
        'Sem nenhum dia de estudo marcado, não dá pra calcular quando ' +
        `você chega no nível ${targetLevel}. Ajuste sua disponibilidade.`,
    };
  }

  const estimatedArrival = cursor.toISOString().slice(0, 10);
  const weeksNeeded = Math.ceil(days / 7);
  const realistic =
    targetDate === null || cursor.getTime() <= targetDate.getTime();

  return {
    estimatedArrival,
    weeksNeeded,
    realistic,
    message: realistic
      ? null
      : `No seu ritmo atual, você chega no nível ${targetLevel} em ` +
        `${String(weeksNeeded)} semanas (${estimatedArrival}) — depois da ` +
        'data que você marcou.',
  };
}

export function buildPath(input: {
  courseLessons: readonly CourseLesson[];
  skillGraph: ReadonlyMap<string, SkillNode>;
  masteryBySkill: MasteryBySkill;
  weaknessSkillIds: readonly string[];
  goals: readonly LearningGoal[];
  startLevel: CefrLevel;
  targetLevel: CefrLevel;
  targetDate: Date | null;
  availabilityMinutes: AvailabilityMinutes;
  now: Date;
}): BuildPathResult {
  const startIdx = levelIndex(input.startLevel);
  const targetIdx = Math.max(levelIndex(input.targetLevel), startIdx);
  const goals = new Set(input.goals);

  const inRange = input.courseLessons.filter((lesson) => {
    const idx = levelIndex(lesson.cefrLevel);
    return idx >= startIdx && idx <= targetIdx;
  });

  const notMastered = inRange.filter(
    (lesson) => !isMastered(lesson.targetSkillIds, input.masteryBySkill),
  );

  const ordered = prioritizeByGoal(notMastered, input.skillGraph, goals);

  const path: PathEntry[] = ordered.map((lesson, index) => ({
    lessonId: lesson.lessonId,
    unitId: lesson.unitId,
    title: lesson.title,
    cefrLevel: lesson.cefrLevel,
    estimatedMinutes: lesson.estimatedMinutes,
    order: index,
    reason: reasonFor(lesson, input.skillGraph, goals),
  }));

  const reinforceSkillIds = input.weaknessSkillIds.filter((skillId) => {
    const node = input.skillGraph.get(skillId);
    if (node === undefined) return true;
    return node.prerequisiteIds.every(
      (prereqId) =>
        (input.masteryBySkill.get(prereqId)?.mastery ?? 0) >= MASTERY_THRESHOLD,
    );
  });

  const remainingMinutes = ordered.reduce(
    (sum, lesson) => sum + lesson.estimatedMinutes,
    0,
  );

  return {
    path,
    reinforceSkillIds,
    forecast: forecastOf(
      remainingMinutes,
      input.availabilityMinutes,
      input.targetLevel,
      input.targetDate,
      input.now,
    ),
  };
}
