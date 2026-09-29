import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import {
  GENERATED_MATERIAL_JOB,
  LESSON_COMPLETED_JOB,
  TUTOR_FEEDBACK_JOB,
  WRONG_ANSWER_JOB,
  type ErrorSource,
} from '../services/srs-update.service';

/**
 * O que acorda o SRS: `lesson.completed` cria os cards da lição, e
 * `answer.submitted` errado de primeira tentativa registra o lapse — acerto
 * não mexe em nada aqui, só a revisão de verdade (`POST /reviews/:id/answer`)
 * agenda o próximo `due` de um card existente. `tutor.feedback` (12) faz o
 * mesmo com os erros que a correção ou o roleplay acharam, e
 * `generator.material_delivered` (13) cria os cards do vocabulário e das
 * skills-alvo de um material.
 */
@Injectable()
export class SrsListener {
  constructor(@InjectQueue(QUEUES.SCHEDULING) private readonly queue: Queue) {}

  @OnEvent('lesson.completed')
  async onLessonCompleted(
    event: DomainEvent<'lesson.completed'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      LESSON_COMPLETED_JOB,
      { userId, lessonVersionId: payload.lessonVersionId },
      { jobId: `lesson-${payload.attemptId}` },
    );
  }

  /** Só ids vão para o job — a frase do aluno não é preciso aqui. */
  @OnEvent('tutor.feedback')
  async onTutorFeedback(event: DomainEvent<'tutor.feedback'>): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      TUTOR_FEEDBACK_JOB,
      {
        userId,
        errorPatternIds: payload.errorPatterns.map((error) => error.id),
        missedSkillIds: payload.skills
          .filter((skill) => !skill.met)
          .map((skill) => skill.skillId),
        expressionSkillIds: payload.expressionSkillIds,
      },
      { jobId: `tutor-${payload.feedbackId}` },
    );
  }

  @OnEvent('answer.submitted')
  async onAnswerSubmitted(
    event: DomainEvent<'answer.submitted'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined || !payload.isFirstTry || payload.isCorrect) {
      return;
    }

    await this.queue.add(
      WRONG_ANSWER_JOB,
      {
        userId,
        primarySkillId: payload.skillIds[0],
        errorPatternIds: payload.errorPatterns,
        source: errorSourceFor(payload.context),
      },
      { jobId: `wrong-${payload.answerId}` },
    );
  }

  @OnEvent('generator.material_delivered')
  async onMaterialDelivered(
    event: DomainEvent<'generator.material_delivered'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      GENERATED_MATERIAL_JOB,
      {
        userId,
        termIds: payload.termIds,
        skillIds: payload.targetSkillIds,
      },
      { jobId: `material-${payload.materialId}` },
    );
  }
}

/**
 * Resposta de exercício de material gerado lapsa o card com a origem dela.
 * `REVIEW` e `TARGETED_PRACTICE` (prática de ponto fraco da agenda, 10) não
 * têm `ReviewCardSource` própria — entram no mesmo balde de `LESSON`.
 */
function errorSourceFor(context: string): ErrorSource {
  return context === 'GENERATED_MATERIAL' ? 'GENERATED_MATERIAL' : 'LESSON';
}
