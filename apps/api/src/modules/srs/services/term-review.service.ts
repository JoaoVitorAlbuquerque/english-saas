import { Injectable } from '@nestjs/common';
import type { ReviewCardSource } from '@prisma/client';

import { normalizeTerm } from '../domain/card-creation';
import { ReviewCardService } from './review-card.service';
import { StudyTermService, type StudyTermInput } from './study-term.service';

/**
 * Termo solto na revisão por pedido do aluno — o "Adicionar à revisão" /
 * "Remover" do vocabulário de um material (13). A chave é o termo
 * normalizado, a mesma do dedup de `StudyTerm`: o mesmo termo em dois
 * materiais é um card só, então tirar num tira no outro.
 *
 * Sem a trava por aluno do `SrsUpdateService`: cada operação mexe numa
 * linha só, e o índice único de `[userId, kind, refId]` já basta.
 */
@Injectable()
export class TermReviewService {
  constructor(
    private readonly terms: StudyTermService,
    private readonly cards: ReviewCardService,
  ) {}

  /** Quais dessas chaves têm card TERM ativo. */
  async activeKeys(
    userId: string,
    keys: readonly string[],
  ): Promise<Set<string>> {
    const rows = await this.terms.byKeys(userId, keys);
    const active = await this.cards.activeRefIds(
      userId,
      'TERM',
      rows.map((row) => row.id),
    );

    return new Set(
      rows.filter((row) => active.has(row.id)).map((row) => row.normalizedTerm),
    );
  }

  /** Cria o termo e o card que faltarem, ou reativa o card suspenso. */
  async add(
    userId: string,
    source: ReviewCardSource,
    term: StudyTermInput,
    now = new Date(),
  ): Promise<void> {
    const [termId] = await this.terms.upsertMany(userId, source, [term]);

    if (termId !== undefined) {
      await this.cards.activate(userId, 'TERM', termId, source, now);
    }
  }

  /** Suspende o card do termo. Termo ou card inexistente: nada a fazer. */
  async remove(userId: string, key: string): Promise<void> {
    const [row] = await this.terms.byKeys(userId, [normalizeTerm(key)]);

    if (row !== undefined) {
      await this.cards.suspend(userId, 'TERM', row.id);
    }
  }
}
