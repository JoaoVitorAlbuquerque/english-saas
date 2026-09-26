/**
 * Textos das notificações, em pt-BR. Específicos (quanto tempo, o quê) e
 * sem culpa nem chantagem: nada de "você esqueceu", "sua sequência vai
 * acabar" ou exclamação em série. O aluno decide; a gente só informa.
 */

export type NotificationContent = {
  title: string;
  body: string;
  /** Caminho no front, relativo ao `WEB_URL`. */
  path: string;
};

export type PendingBlock = {
  type: 'REVIEW' | 'LESSON' | 'PRACTICE';
  estimatedMinutes: number;
  title?: string | undefined;
  count?: number | undefined;
};

/** Tamanho da sessão sugerida no aviso de revisões acumuladas. */
export const BACKLOG_SESSION_MINUTES = 10;
const SECONDS_PER_CARD = 25;

export function dailyReminderMessage(
  blocks: readonly PendingBlock[],
): NotificationContent {
  const minutes = Math.round(
    blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
  );
  const parts: string[] = [];

  const review = blocks.find((block) => block.type === 'REVIEW');
  if (review !== undefined) {
    parts.push(
      review.count === undefined
        ? 'a revisão do dia'
        : plural(review.count, 'revisão', 'revisões'),
    );
  }

  for (const lesson of blocks.filter((block) => block.type === 'LESSON')) {
    parts.push(
      lesson.title === undefined
        ? 'a próxima lição'
        : `a lição "${lesson.title}"`,
    );
  }

  const practice = blocks.filter((block) => block.type === 'PRACTICE').length;
  if (practice > 0) {
    parts.push(
      plural(practice, 'exercício de prática', 'exercícios de prática'),
    );
  }

  return {
    title: 'Seu plano de hoje',
    body: `Faltam ${String(minutes)} min para fechar o plano de hoje: ${joinPt(parts)}.`,
    path: '/hoje',
  };
}

export function reviewBacklogMessage(dueCards: number): NotificationContent {
  const capacity = Math.floor(
    (BACKLOG_SESSION_MINUTES * 60) / SECONDS_PER_CARD,
  );
  const session =
    dueCards <= capacity
      ? `Uma sessão de ${String(BACKLOG_SESSION_MINUTES)} min dá conta de todas.`
      : `Uma sessão de ${String(BACKLOG_SESSION_MINUTES)} min já dá conta de ${String(capacity)} delas.`;

  return {
    title: 'Revisões esperando por você',
    body: `Você tem ${String(dueCards)} revisões esperando. ${session}`,
    path: '/revisao',
  };
}

export type WeekNumbers = {
  studyMinutes: number;
  plannedMinutes: number;
  lessonsCompleted: number;
  reviewsDone: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
  activeDays: number;
};

export function weeklySummaryMessage(week: WeekNumbers): NotificationContent {
  if (week.activeDays === 0) {
    return {
      title: 'Sua semana no inglês',
      body: 'Na semana passada não teve estudo registrado. Quando quiser retomar, o plano de hoje já está pronto.',
      path: '/progresso',
    };
  }

  const pieces = [
    `${String(week.studyMinutes)} min de estudo em ${plural(week.activeDays, 'dia', 'dias')}`,
    plural(week.lessonsCompleted, 'lição concluída', 'lições concluídas'),
    plural(week.reviewsDone, 'revisão', 'revisões'),
  ];
  const sentences = [`Na semana passada: ${joinPt(pieces)}.`];

  if (week.firstTryAnswers > 0) {
    const rate = Math.round(
      (week.firstTryCorrect / week.firstTryAnswers) * 100,
    );
    sentences.push(`Acerto de primeira: ${String(rate)}%.`);
  }

  if (week.plannedMinutes > 0) {
    sentences.push(
      week.studyMinutes >= week.plannedMinutes
        ? `Você cumpriu os ${String(week.plannedMinutes)} min planejados.`
        : `O planejado era ${String(week.plannedMinutes)} min; se a rotina mudou, dá para ajustar a disponibilidade no seu perfil.`,
    );
  }

  return {
    title: 'Sua semana no inglês',
    body: sentences.join(' '),
    path: '/progresso',
  };
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** "a", "a e b", "a, b e c". */
export function joinPt(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1) ?? ''}`;
}
