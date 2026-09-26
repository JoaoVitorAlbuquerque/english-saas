import { Injectable } from '@nestjs/common';
import type { CefrLevel, ReviewCardSource, StudyTerm } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';

import { normalizeTerm } from '../domain/card-creation';

export type StudyTermInput = {
  term: string;
  meaning: string;
  example: string;
  cefrLevel: CefrLevel;
};

/**
 * Termos soltos do aluno — o que o card TERM revisa. Vêm dos materiais do
 * generator (13), que não têm skill do catálogo por palavra.
 *
 * Dedup por aluno e termo normalizado: o mesmo termo em dois materiais é um
 * card só, e o significado que fica é o primeiro.
 */
@Injectable()
export class StudyTermService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grava o que falta e devolve os ids de todos, na ordem recebida. */
  async upsertMany(
    userId: string,
    source: ReviewCardSource,
    terms: readonly StudyTermInput[],
  ): Promise<string[]> {
    const byKey = new Map<string, StudyTermInput>();

    for (const term of terms) {
      const key = normalizeTerm(term.term);
      if (key.length > 0 && !byKey.has(key)) {
        byKey.set(key, term);
      }
    }

    if (byKey.size === 0) {
      return [];
    }

    await this.prisma.studyTerm.createMany({
      data: [...byKey.entries()].map(([normalizedTerm, term]) => ({
        userId,
        term: term.term.trim(),
        normalizedTerm,
        meaning: term.meaning,
        example: term.example,
        cefrLevel: term.cefrLevel,
        source,
      })),
      skipDuplicates: true,
    });

    const rows = await this.prisma.studyTerm.findMany({
      where: { userId, normalizedTerm: { in: [...byKey.keys()] } },
      select: { id: true, normalizedTerm: true },
    });
    const idByKey = new Map(rows.map((row) => [row.normalizedTerm, row.id]));

    return [...byKey.keys()].flatMap((key) => {
      const id = idByKey.get(key);
      return id === undefined ? [] : [id];
    });
  }

  async byIds(userId: string, ids: readonly string[]): Promise<StudyTerm[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.studyTerm.findMany({
      where: { userId, id: { in: [...ids] } },
    });
  }
}
