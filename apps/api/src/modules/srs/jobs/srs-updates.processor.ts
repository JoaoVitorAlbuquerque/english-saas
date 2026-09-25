import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, type Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  LESSON_COMPLETED_JOB,
  SrsUpdateService,
  TUTOR_FEEDBACK_JOB,
  WRONG_ANSWER_JOB,
  type SrsUpdateOutcome,
} from '../services/srs-update.service';

type LessonCompletedJobData = { userId: string; lessonVersionId: string };

type TutorFeedbackJobData = {
  userId: string;
  errorPatternIds: string[];
  missedSkillIds: string[];
  expressionSkillIds: string[];
};

type WrongAnswerJobData = {
  userId: string;
  primarySkillId: string | undefined;
  errorPatternIds: string[];
};

/** Espera quando outro worker está com o mesmo aluno. */
const LOCKED_RETRY_MS = 500;

@Processor(QUEUES.SCHEDULING, defaultWorkerOptions())
export class SrsUpdatesProcessor extends WorkerHost {
  constructor(private readonly updates: SrsUpdateService) {
    super();
  }

  async process(
    job: Job<
      LessonCompletedJobData | WrongAnswerJobData | TutorFeedbackJobData
    >,
    token?: string,
  ): Promise<unknown> {
    let outcome: SrsUpdateOutcome;

    if (job.name === LESSON_COMPLETED_JOB) {
      const data = job.data as LessonCompletedJobData;
      outcome = await this.updates.onLessonCompleted(
        data.userId,
        data.lessonVersionId,
      );
    } else if (job.name === WRONG_ANSWER_JOB) {
      const data = job.data as WrongAnswerJobData;
      outcome = await this.updates.onWrongFirstTry(
        data.userId,
        data.primarySkillId,
        data.errorPatternIds,
      );
    } else if (job.name === TUTOR_FEEDBACK_JOB) {
      const { userId, ...feedback } = job.data as TutorFeedbackJobData;
      outcome = await this.updates.onTutorFeedback(userId, feedback);
    } else {
      return { skipped: true };
    }

    if (outcome.status === 'LOCKED') {
      await job.moveToDelayed(Date.now() + LOCKED_RETRY_MS, token);
      throw new DelayedError();
    }

    return outcome;
  }
}
