import { Injectable } from '@nestjs/common';

import { ItemService } from 'src/modules/curriculum/services/item.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import {
  DEFAULT_TARGET_P,
  selectLeveledItems,
  type SelectedItem,
} from '../domain/select-items';

/** Questão respondida nesse período não volta numa lista nivelada. */
const RECENT_WINDOW_DAYS = 14;

/**
 * Questões niveladas para o aluno: as que ele tem ~70% de chance de
 * acertar. Desafiador sem frustrar.
 *
 * É o ponto de entrada de quem monta prova, revisão ou exercício — o
 * planner (10), o SRS (9) e o generator (13) chamam daqui, nunca escolhem
 * questão por conta própria.
 */
@Injectable()
export class AdaptiveItemService {
  constructor(
    private readonly items: ItemService,
    private readonly answers: AnswerService,
    private readonly profiles: LearnerProfileService,
  ) {}

  async selectItems(input: {
    userId: string;
    skills: readonly string[];
    count: number;
    targetP?: number;
    random?: () => number;
    now?: Date;
  }): Promise<SelectedItem[]> {
    if (input.skills.length === 0 || input.count <= 0) {
      return [];
    }

    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - RECENT_WINDOW_DAYS * 86_400_000);

    const [thetas, candidates, recent] = await Promise.all([
      this.profiles.skillThetas(input.userId, input.skills, now),
      this.items.findCandidates({ skillIds: input.skills }),
      this.answers.answeredItemIds(input.userId, { since }),
    ]);

    return selectLeveledItems({
      candidates,
      skills: input.skills.flatMap((skillId) => {
        const theta = thetas.get(skillId);
        return theta === undefined ? [] : [{ skillId, theta }];
      }),
      count: input.count,
      targetP: input.targetP ?? DEFAULT_TARGET_P,
      excludeItemIds: new Set(recent),
      random: input.random ?? Math.random,
    });
  }
}
