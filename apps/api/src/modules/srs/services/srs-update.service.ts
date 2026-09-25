import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from 'src/infra/redis/redis.service';
import { withLock as withUserLock } from 'src/infra/redis/user-lock';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';

import {
  candidatesFromLessonOutline,
  kindForSkillType,
  newCandidates,
} from '../domain/card-creation';
import { ReviewCardService } from './review-card.service';

export const LESSON_COMPLETED_JOB = 'srs-lesson-completed';
export const WRONG_ANSWER_JOB = 'srs-wrong-answer';

/** A trava expira sozinha se o worker morrer segurando. */
const LOCK_TTL_MS = 60_000;

export type SrsUpdateOutcome = { status: 'LOCKED' } | { status: 'DONE' };

/**
 * Cria e atualiza os cards de revisão a partir do que o aluno faz na lição.
 *
 * Mesmo padrão do learner-model (7): trava por aluno no Redis, para não
 * cruzar duas escritas do mesmo aluno ao mesmo tempo. Como cada card é
 * idempotente (`@@unique([userId, kind, refId])`) e criado sob a trava, não
 * precisa de marca d'água — reprocessar um evento não duplica nada.
 */
@Injectable()
export class SrsUpdateService {
  private readonly logger = new Logger(SrsUpdateService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly cards: ReviewCardService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  static lockKey(userId: string): string {
    return `srs:lock:${userId}`;
  }

  /** Lição concluída: card para cada skill-alvo, chunk, vocabulário e nota nova. */
  async onLessonCompleted(
    userId: string,
    lessonVersionId: string,
    now = new Date(),
  ): Promise<SrsUpdateOutcome> {
    return this.withLock(userId, async () => {
      const outline = await this.catalog.lessonVersionOutline(lessonVersionId);
      const skillIds = [
        ...new Set([...outline.targetSkillIds, ...outline.referencedSkillIds]),
      ];
      const skills = await this.taxonomy.skillsByIds(skillIds);
      const skillTypeById = new Map(
        skills.map((skill) => [skill.id, skill.type]),
      );

      const candidates = candidatesFromLessonOutline(outline, skillTypeById);
      const existing = await this.cards.existingKeys(userId, candidates);
      const toCreate = newCandidates(candidates, existing);

      await this.cards.createMany(userId, 'LESSON', toCreate, now);

      this.logger.log(
        { userId, lessonVersionId, created: toCreate.length },
        'Cards de revisão criados a partir da lição',
      );
    });
  }

  /**
   * Errou de primeira tentativa: card da skill principal e de cada
   * ErrorPattern revelado, com lapse se já existia (ver `ensureOrLapse`).
   *
   * A skill principal pode ser vocabulário ou chunk (`vocab.numbers-1-20` é
   * a principal de "I'm 20 years old", por exemplo) — o `kind` do card segue
   * o `SkillType` dela, não é sempre SKILL.
   */
  async onWrongFirstTry(
    userId: string,
    primarySkillId: string | undefined,
    errorPatternIds: readonly string[],
    now = new Date(),
  ): Promise<SrsUpdateOutcome> {
    return this.withLock(userId, async () => {
      if (primarySkillId !== undefined) {
        const [skill] = await this.taxonomy.skillsByIds([primarySkillId]);

        if (skill !== undefined) {
          await this.cards.ensureOrLapse(
            userId,
            kindForSkillType(skill.type),
            primarySkillId,
            'LESSON',
            now,
          );
        }
      }

      for (const errorPatternId of errorPatternIds) {
        await this.cards.ensureOrLapse(
          userId,
          'ERROR_PATTERN',
          errorPatternId,
          'LESSON',
          now,
        );
      }
    });
  }

  private async withLock(
    userId: string,
    work: () => Promise<void>,
  ): Promise<SrsUpdateOutcome> {
    const outcome = await withUserLock(
      this.redis,
      SrsUpdateService.lockKey(userId),
      LOCK_TTL_MS,
      work,
    );

    return outcome.status === 'LOCKED'
      ? { status: 'LOCKED' }
      : { status: 'DONE' };
  }
}
