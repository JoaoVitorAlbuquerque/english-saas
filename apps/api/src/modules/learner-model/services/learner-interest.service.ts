import { Injectable } from '@nestjs/common';

import { normalizeTopic } from 'src/modules/users/domain/interests';
import { UsersService } from 'src/modules/users/services/users.service';

import { applyInterestSignal, type InterestSignal } from '../domain/interests';
import { LearnerProfileService } from './learner-profile.service';

/**
 * Interesses aprendidos pelo uso.
 *
 * Quem chama é o generator (13), quando o aluno gera, conclui, avalia ou
 * abandona um material. A tabela de interesses é do módulo `users`: aqui só
 * se decide o peso novo e se pede para ele gravar.
 */
@Injectable()
export class LearnerInterestService {
  constructor(
    private readonly users: UsersService,
    private readonly profiles: LearnerProfileService,
  ) {}

  async applySignal(
    userId: string,
    topic: string,
    signal: InterestSignal,
  ): Promise<number | null> {
    const slug = normalizeTopic(topic);

    if (slug.length < 2) {
      return null;
    }

    const current = (await this.users.listInterests(userId)).find(
      (interest) => interest.topic === slug,
    );
    const weight = applyInterestSignal(current?.weight ?? null, signal);

    if (weight === null) {
      return null;
    }

    await this.users.setInterestWeight(userId, slug, weight);
    await this.profiles.invalidate(userId);

    return weight;
  }
}
