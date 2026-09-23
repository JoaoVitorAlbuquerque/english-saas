/**
 * Nomes das filas BullMQ.
 *
 * Toda tarefa lenta ou que chama IA entra aqui — o request HTTP nunca
 * espera por ela (ver CLAUDE.md → Convenções).
 * A fila só passa a existir quando o módulo dono dela for implementado.
 */
export const QUEUES = {
  /** Chamadas de IA: correção de produção livre, geração de material. */
  AI: 'ai',
  /** Síntese e transcodificação de áudio das cenas. */
  MEDIA: 'media',
  /** Recálculo de mastery e do modelo do aluno após tentativas. */
  LEARNER_MODEL: 'learner-model',
  /** Reagendamento de revisão espaçada e do cronograma. */
  SCHEDULING: 'scheduling',
  /** E-mail, push e lembretes. */
  NOTIFICATIONS: 'notifications',
  /** Webhooks e sincronização de assinatura com o Asaas. */
  BILLING: 'billing',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
