import { z } from 'zod';

/** Papéis do sistema. STUDENT é o padrão de quem se cadastra. */
export const ROLES = ['STUDENT', 'EDITOR', 'ADMIN'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Aluno',
  EDITOR: 'Editor de conteúdo',
  ADMIN: 'Administrador',
};

/** Por que o aluno está estudando inglês. */
export const LEARNING_GOALS = [
  'TRAVEL',
  'WORK',
  'EXAMS',
  'SCHOOL',
  'MOVING_ABROAD',
  'CONVERSATION',
  'OTHER',
] as const;
export const learningGoalSchema = z.enum(LEARNING_GOALS);
export type LearningGoal = z.infer<typeof learningGoalSchema>;

export const LEARNING_GOAL_LABELS: Record<LearningGoal, string> = {
  TRAVEL: 'Viajar',
  WORK: 'Trabalho',
  EXAMS: 'Provas e certificações',
  SCHOOL: 'Escola ou faculdade',
  MOVING_ABROAD: 'Morar fora',
  CONVERSATION: 'Conversar com gente de outros países',
  OTHER: 'Outro motivo',
};

/** Nível que o próprio aluno diz ter, antes do teste de nivelamento. */
export const SELF_REPORTED_LEVELS = [
  'NONE',
  'BASIC',
  'INTERMEDIATE',
  'ADVANCED',
] as const;
export const selfReportedLevelSchema = z.enum(SELF_REPORTED_LEVELS);
export type SelfReportedLevel = z.infer<typeof selfReportedLevelSchema>;

export const SELF_REPORTED_LEVEL_LABELS: Record<SelfReportedLevel, string> = {
  NONE: 'Nunca estudei inglês',
  BASIC: 'Sei o básico',
  INTERMEDIATE: 'Me viro em conversas',
  ADVANCED: 'Falo com facilidade',
};

export const PREFERRED_STUDY_TIMES = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'NIGHT',
  'ANY',
] as const;
export const preferredStudyTimeSchema = z.enum(PREFERRED_STUDY_TIMES);
export type PreferredStudyTime = z.infer<typeof preferredStudyTimeSchema>;

export const PREFERRED_STUDY_TIME_LABELS: Record<PreferredStudyTime, string> = {
  MORNING: 'De manhã',
  AFTERNOON: 'À tarde',
  EVENING: 'No fim do dia',
  NIGHT: 'À noite',
  ANY: 'Tanto faz',
};

/** Dias da semana, na ordem em que a agenda é exibida. */
export const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

/** Minutos que o aluno tem por dia. Teto de 8h: acima disso é engano. */
export const MAX_MINUTES_PER_DAY = 480;

export const availabilityMinutesSchema = z.object({
  mon: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  tue: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  wed: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  thu: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  fri: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  sat: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
  sun: z.number().int().min(0).max(MAX_MINUTES_PER_DAY).default(0),
});

export type AvailabilityMinutes = z.infer<typeof availabilityMinutesSchema>;

/** Interesse do aluno: tema em slug inglês + peso de 0 a 100. */
export const MIN_INTEREST_WEIGHT = 0;
export const MAX_INTEREST_WEIGHT = 100;

export const interestSchema = z.object({
  topic: z
    .string()
    .min(2)
    .max(40)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'O tema deve ser um slug em minúsculas, ex.: "history" ou "world-cup".',
    ),
  weight: z
    .number()
    .int()
    .min(MIN_INTEREST_WEIGHT)
    .max(MAX_INTEREST_WEIGHT)
    .default(50),
});

export type Interest = z.infer<typeof interestSchema>;

/** Temas sugeridos no onboarding. O aluno pode digitar outros. */
export const SUGGESTED_INTERESTS = [
  'history',
  'football',
  'technology',
  'music',
  'agriculture',
  'cooking',
  'movies',
  'travel',
  'business',
  'science',
  'games',
  'health',
] as const;

export const SUGGESTED_INTEREST_LABELS: Record<string, string> = {
  history: 'História',
  football: 'Futebol',
  technology: 'Tecnologia',
  music: 'Música',
  agriculture: 'Agronegócio',
  cooking: 'Culinária',
  movies: 'Filmes e séries',
  travel: 'Viagens',
  business: 'Negócios',
  science: 'Ciência',
  games: 'Games',
  health: 'Saúde',
};

/** Consentimentos LGPD registrados por versão de documento. */
export const CONSENT_TYPES = [
  'TERMS',
  'PRIVACY_POLICY',
  'DATA_PERSONALIZATION',
  'MARKETING',
] as const;
export const consentTypeSchema = z.enum(CONSENT_TYPES);
export type ConsentType = z.infer<typeof consentTypeSchema>;

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  TERMS: 'Termos de uso',
  PRIVACY_POLICY: 'Política de privacidade',
  DATA_PERSONALIZATION: 'Uso dos meus dados para personalizar o estudo',
  MARKETING: 'Receber novidades e ofertas',
};

/** Sem estes dois o aluno não usa a plataforma. */
export const REQUIRED_CONSENTS: ConsentType[] = ['TERMS', 'PRIVACY_POLICY'];

export const DATA_EXPORT_STATUSES = ['PENDING', 'READY', 'FAILED'] as const;
export const dataExportStatusSchema = z.enum(DATA_EXPORT_STATUSES);
export type DataExportStatus = z.infer<typeof dataExportStatusSchema>;

/** Dias entre o pedido de exclusão e a anonimização definitiva. */
export const ANONYMIZATION_GRACE_DAYS = 30;
