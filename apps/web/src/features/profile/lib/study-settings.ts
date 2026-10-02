import type {
  StudentProfile,
  UpdateProfileRequest,
} from '@english-saas/api-client';
import {
  WEEKDAYS,
  type AvailabilityMinutes,
  type CefrLevel,
  type Interest,
  type LearningGoal,
  type PreferredStudyTime,
} from '@english-saas/shared';

/** O que a tela Estudo edita, num formato só — comparável com `diffStudySettings`. */
export type StudyForm = {
  goals: LearningGoal[];
  /** Texto vazio = sem observação. */
  goalNote: string;
  availabilityMinutes: AvailabilityMinutes;
  preferredStudyTime: PreferredStudyTime;
  /** `YYYY-MM-DD`, ou vazio = sem data-alvo. */
  targetDate: string;
  targetLevel: CefrLevel;
  interests: Interest[];
};

/** Sem plano ainda, o back-end monta para C1 (`plan.service`). */
export const DEFAULT_TARGET_LEVEL: CefrLevel = 'C1';

export function formFromServer(input: {
  profile: StudentProfile;
  interests: Interest[];
  targetLevel: CefrLevel | null;
}): StudyForm {
  return {
    goals: input.profile.goals,
    goalNote: input.profile.goalNote ?? '',
    availabilityMinutes: input.profile.availabilityMinutes,
    preferredStudyTime: input.profile.preferredStudyTime,
    targetDate: input.profile.targetDate?.slice(0, 10) ?? '',
    targetLevel: input.targetLevel ?? DEFAULT_TARGET_LEVEL,
    interests: input.interests,
  };
}

export type StudyChanges = {
  /** Só os campos do perfil que mudaram; `{}` quando nenhum. */
  profile: UpdateProfileRequest;
  /** A lista inteira, ou `null` se não mudou. */
  interests: Interest[] | null;
  /** Só quando mudou: vira `POST /me/plan/rebuild`. */
  targetLevel: CefrLevel | null;
  /** Algo que o planner recalcula mudou — é o que o diálogo avisa. */
  replansPlan: boolean;
  hasChanges: boolean;
};

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function sameAvailability(a: AvailabilityMinutes, b: AvailabilityMinutes) {
  return WEEKDAYS.every((day) => a[day] === b[day]);
}

function sameInterests(a: Interest[], b: Interest[]): boolean {
  const key = (interest: Interest) => `${interest.topic}:${interest.weight}`;

  return sameSet(a.map(key), b.map(key));
}

/**
 * O que mudou entre o que veio do servidor e o que o aluno deixou na tela.
 * Disponibilidade, data-alvo, objetivos e nível-alvo fazem o planner
 * recalcular o plano (`profile.availability_changed` / `rebuild`); horário
 * preferido, observação e interesses não.
 */
export function diffStudySettings(
  initial: StudyForm,
  current: StudyForm,
): StudyChanges {
  const profile: UpdateProfileRequest = {};

  if (!sameSet(initial.goals, current.goals)) {
    profile.goals = current.goals;
  }

  if (initial.goalNote.trim() !== current.goalNote.trim()) {
    profile.goalNote =
      current.goalNote.trim() === '' ? null : current.goalNote.trim();
  }

  if (
    !sameAvailability(initial.availabilityMinutes, current.availabilityMinutes)
  ) {
    // A semana inteira: o back-end troca a disponibilidade toda de uma vez.
    profile.availabilityMinutes = current.availabilityMinutes;
  }

  if (initial.preferredStudyTime !== current.preferredStudyTime) {
    profile.preferredStudyTime = current.preferredStudyTime;
  }

  if (initial.targetDate !== current.targetDate) {
    profile.targetDate = current.targetDate === '' ? null : current.targetDate;
  }

  const interests = sameInterests(initial.interests, current.interests)
    ? null
    : current.interests;
  const targetLevel =
    initial.targetLevel === current.targetLevel ? null : current.targetLevel;

  const replansPlan =
    profile.goals !== undefined ||
    profile.availabilityMinutes !== undefined ||
    profile.targetDate !== undefined ||
    targetLevel !== null;

  return {
    profile,
    interests,
    targetLevel,
    replansPlan,
    hasChanges:
      Object.keys(profile).length > 0 ||
      interests !== null ||
      targetLevel !== null,
  };
}

export function weeklyMinutes(availability: AvailabilityMinutes): number {
  return WEEKDAYS.reduce((sum, day) => sum + availability[day], 0);
}
