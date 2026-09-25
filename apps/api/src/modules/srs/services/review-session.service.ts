import { Injectable } from '@nestjs/common';
import type { ReviewCard } from '@prisma/client';

import { AdaptiveItemService } from 'src/modules/assessment/services/adaptive-item.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';

import { buildSession } from '../domain/session';
import { ReviewCardService } from './review-card.service';

type StudentItem = Awaited<ReturnType<CatalogService['studentItems']>>[number];

export type SessionExercise =
  | { type: 'ITEM'; item: StudentItem }
  | { type: 'FLASHCARD'; front: string; back: string };

export type SessionCard = {
  cardId: string;
  kind: ReviewCard['kind'];
  due: Date;
  exercise: SessionExercise;
};

/** Mira 70% de acerto — a mesma régua do `selectItems` (assessment, 8). */
const ITEM_TARGET_P = 0.7;

/**
 * Monta a sessão de revisão: cards vencidos, cortados pelo tempo do aluno
 * (ver `domain/session.ts`), cada um já com o exercício pronto.
 *
 * SKILL usa uma questão real do banco, nivelada pelo `AdaptiveItemService`
 * (8). Os demais viram um flashcard simples — frente/verso — porque não há
 * banco calibrado de vocabulário, chunk, nota de registro ou padrão de erro.
 */
@Injectable()
export class ReviewSessionService {
  constructor(
    private readonly cards: ReviewCardService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
    private readonly adaptiveItems: AdaptiveItemService,
  ) {}

  async build(
    userId: string,
    minutes: number,
    now = new Date(),
  ): Promise<SessionCard[]> {
    const due = await this.cards.dueFor(userId, now);
    const selected = buildSession(due, now, minutes);

    const skillCards = selected.filter((card) => card.kind === 'SKILL');
    const vocabChunkCards = selected.filter(
      (card) => card.kind === 'VOCAB' || card.kind === 'CHUNK',
    );
    const registerCards = selected.filter(
      (card) => card.kind === 'REGISTER_NOTE',
    );
    const errorCards = selected.filter((card) => card.kind === 'ERROR_PATTERN');

    const [itemByCardId, skills, notes, patterns] = await Promise.all([
      this.itemsFor(userId, skillCards, now),
      this.taxonomy.skillsByIds(vocabChunkCards.map((card) => card.refId)),
      this.taxonomy.registerNotesByIds(registerCards.map((card) => card.refId)),
      this.taxonomy.errorPatternSummaries(errorCards.map((card) => card.refId)),
    ]);

    const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
    const notesById = new Map(notes.map((note) => [note.id, note]));
    const patternsById = new Map(
      patterns.map((pattern) => [pattern.id, pattern]),
    );

    return selected.flatMap((card): SessionCard[] => {
      if (card.kind === 'SKILL') {
        const item = itemByCardId.get(card.id);
        return item === undefined
          ? []
          : [
              {
                cardId: card.id,
                kind: card.kind,
                due: card.due,
                exercise: { type: 'ITEM', item },
              },
            ];
      }

      if (card.kind === 'VOCAB' || card.kind === 'CHUNK') {
        const skill = skillsById.get(card.refId);
        return skill === undefined
          ? []
          : [
              {
                cardId: card.id,
                kind: card.kind,
                due: card.due,
                exercise: {
                  type: 'FLASHCARD',
                  front: skill.title,
                  back: skill.description ?? skill.title,
                },
              },
            ];
      }

      if (card.kind === 'REGISTER_NOTE') {
        const note = notesById.get(card.refId);
        return note === undefined
          ? []
          : [
              {
                cardId: card.id,
                kind: card.kind,
                due: card.due,
                exercise: {
                  type: 'FLASHCARD',
                  front: note.spokenForm,
                  back: `${note.standardForm} — ${note.explanation}`,
                },
              },
            ];
      }

      const pattern = patternsById.get(card.refId);
      return pattern === undefined
        ? []
        : [
            {
              cardId: card.id,
              kind: card.kind,
              due: card.due,
              exercise: {
                type: 'FLASHCARD',
                front: pattern.description,
                back: `${pattern.correction} — ${pattern.explanation}`,
              },
            },
          ];
    });
  }

  private async itemsFor(
    userId: string,
    skillCards: readonly ReviewCard[],
    now: Date,
  ): Promise<Map<string, StudentItem>> {
    if (skillCards.length === 0) {
      return new Map();
    }

    const selected = await this.adaptiveItems.selectItems({
      userId,
      skills: skillCards.map((card) => card.refId),
      count: skillCards.length,
      targetP: ITEM_TARGET_P,
      now,
    });

    const itemIdBySkillId = new Map(
      selected.map((entry) => [entry.skillId, entry.itemId]),
    );
    const items = await this.catalog.studentItems([
      ...itemIdBySkillId.values(),
    ]);
    const itemById = new Map(items.map((item) => [item.id, item]));

    const result = new Map<string, StudentItem>();

    for (const card of skillCards) {
      const itemId = itemIdBySkillId.get(card.refId);
      const item = itemId === undefined ? undefined : itemById.get(itemId);
      if (item !== undefined) {
        result.set(card.id, item);
      }
    }

    return result;
  }
}
