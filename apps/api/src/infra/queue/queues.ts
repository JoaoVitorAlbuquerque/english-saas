/**
 * Nomes das filas BullMQ.
 *
 * Toda tarefa lenta ou que chama IA entra aqui — o request HTTP nunca
 * espera por ela (ver CLAUDE.md → Convenções).
 * A fila só passa a existir quando o módulo dono dela for implementado.
 */
export const QUEUES = {
  /** Fila de demonstração da infraestrutura. Sai quando houver fila real. */
  EXAMPLE: 'example',
  /** Export de dados (LGPD) e anonimização de conta após a carência. */
  USERS: 'users',
  /** Chamadas de IA: correção de produção livre, geração de material. */
  AI: 'ai',
  /** Geração de rascunho de lição, item e nota de registro pela IA. */
  CONTENT_DRAFTS: 'content-drafts',
  /** Checagem de nível, consistência e revisão linguística de rascunho. */
  CONTENT_QA: 'content-qa',
  /** Síntese de voz das cenas e geração das apostilas em PDF. */
  MEDIA: 'media',
  /** Trabalho em lote sobre o que o aluno fez: estatística dos itens. */
  LEARNING: 'learning',
  /**
   * Atualização do modelo do aluno a cada resposta. Processada em ordem por
   * aluno (trava no Redis + marca d'água), nunca em paralelo para o mesmo.
   */
  LEARNER_UPDATES: 'learner-updates',
  /** Calibração semanal da dificuldade dos itens. */
  ASSESSMENT: 'assessment',
  /** Reagendamento de revisão espaçada (FSRS). */
  SCHEDULING: 'scheduling',
  /** Montagem e recálculo do cronograma e da agenda diária. */
  PLANNER: 'planner',
  /** E-mail, push e lembretes. */
  NOTIFICATIONS: 'notifications',
  /** Webhooks e sincronização de assinatura com o Asaas. */
  BILLING: 'billing',
  /** Correção de produção livre, turnos de roleplay e transcrição de voz. */
  TUTOR: 'tutor',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Filas já registradas na aplicação — as demais entram com seus módulos. */
export const REGISTERED_QUEUES: QueueName[] = [
  QUEUES.EXAMPLE,
  QUEUES.USERS,
  QUEUES.CONTENT_DRAFTS,
  QUEUES.CONTENT_QA,
  QUEUES.MEDIA,
  QUEUES.LEARNING,
  QUEUES.LEARNER_UPDATES,
  QUEUES.ASSESSMENT,
  QUEUES.SCHEDULING,
  QUEUES.PLANNER,
  QUEUES.BILLING,
  QUEUES.TUTOR,
];
