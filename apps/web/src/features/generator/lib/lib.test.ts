import type {
  GenerationJob,
  GenerationStep,
  MaterialSummary,
  StepStatus,
} from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { formatInTimeZone } from './format-date';
import { toJobPhases } from './job-phases';
import { levelEvolution } from './level-evolution';
import { socialPlatformOf } from './social-link';

function job(
  kind: GenerationJob['kind'],
  steps: [GenerationStep, StepStatus][],
): GenerationJob {
  return {
    id: 'job-1',
    kind,
    status: 'RUNNING',
    message: '',
    steps: steps.map(([step, status]) => ({
      step,
      status,
      label: step,
      startedAt: null,
      finishedAt: null,
    })),
    themes: [],
    suggestions: [],
    materialId: null,
    errorCode: null,
    createdAt: '2026-09-29T12:00:00.000Z',
    completedAt: null,
  };
}

describe('toJobPhases', () => {
  it('tema escolhido (sem SUGGEST): a primeira fase já nasce concluída', () => {
    const phases = toJobPhases(
      job('TOPIC', [
        ['FETCH_SOURCE', 'RUNNING'],
        ['PICK_TARGETS', 'PENDING'],
        ['GENERATE', 'PENDING'],
        ['VALIDATE', 'PENDING'],
        ['EXERCISES', 'PENDING'],
        ['DELIVER', 'PENDING'],
      ]),
    );

    expect(phases.map((phase) => [phase.label, phase.status])).toEqual([
      ['Entendendo o tema', 'DONE'],
      ['Buscando a fonte', 'RUNNING'],
      ['Escrevendo no seu nível', 'PENDING'],
      ['Conferindo os fatos', 'PENDING'],
    ]);
  });

  it('fase com várias etapas fica RUNNING até a última terminar', () => {
    const phases = toJobPhases(
      job('TOPIC', [
        ['SUGGEST', 'DONE'],
        ['FETCH_SOURCE', 'DONE'],
        ['PICK_TARGETS', 'DONE'],
        ['GENERATE', 'PENDING'],
        ['VALIDATE', 'PENDING'],
        ['EXERCISES', 'PENDING'],
        ['DELIVER', 'PENDING'],
      ]),
    );

    expect(phases[2]?.status).toBe('RUNNING');
    expect(phases[3]?.status).toBe('PENDING');
  });

  it('conteúdo colado: lê → entende → escreve → confere; etapa com falha marca a fase', () => {
    const phases = toJobPhases(
      job('INGEST', [
        ['INGEST_SOURCE', 'DONE'],
        ['ANALYZE', 'FAILED'],
        ['PICK_TARGETS', 'PENDING'],
        ['GENERATE', 'PENDING'],
        ['VALIDATE', 'PENDING'],
        ['EXERCISES', 'PENDING'],
        ['DELIVER', 'PENDING'],
      ]),
    );

    expect(phases.map((phase) => [phase.label, phase.status])).toEqual([
      ['Lendo seu conteúdo', 'DONE'],
      ['Entendendo o texto', 'FAILED'],
      ['Escrevendo no seu nível', 'PENDING'],
      ['Conferindo os fatos', 'PENDING'],
    ]);
  });

  it('pedido de sugestões não tem fases', () => {
    expect(toJobPhases(job('SUGGEST', [['SUGGEST', 'RUNNING']]))).toEqual([]);
  });
});

describe('socialPlatformOf', () => {
  it('reconhece as redes sociais, com e sem subdomínio', () => {
    expect(socialPlatformOf('https://www.youtube.com/watch?v=abc')).toBe(
      'YouTube',
    );
    expect(socialPlatformOf('https://youtu.be/abc')).toBe('YouTube');
    expect(socialPlatformOf('https://m.facebook.com/post/1')).toBe('Facebook');
    expect(socialPlatformOf('https://fb.watch/xyz')).toBe('Facebook');
    expect(socialPlatformOf('https://www.instagram.com/p/1')).toBe('Instagram');
  });

  it('artigo ou texto que não é link: null', () => {
    expect(socialPlatformOf('https://www.bbc.com/news/1')).toBeNull();
    // Domínio que só termina parecido não conta.
    expect(socialPlatformOf('https://notyoutube.com/x')).toBeNull();
    expect(socialPlatformOf('isso não é link')).toBeNull();
  });
});

describe('levelEvolution', () => {
  function summary(id: string, level: MaterialSummary['level'], day: number) {
    return {
      id,
      kind: 'TOPIC',
      title: id,
      level,
      topic: 'história',
      targetSkills: [],
      exerciseCount: 4,
      rating: null,
      difficulty: null,
      createdAt: `2026-0${day}-01T12:00:00.000Z`,
    } satisfies MaterialSummary;
  }

  it('ordena do mais antigo ao mais novo e conta os degraus', () => {
    // A API manda do mais novo para o mais antigo.
    const evolution = levelEvolution([
      summary('c', 'B1', 9),
      summary('b', 'A2', 6),
      summary('a', 'A2', 3),
    ]);

    expect(evolution.points.map((point) => point.id)).toEqual(['a', 'b', 'c']);
    expect(evolution).toMatchObject({ first: 'A2', latest: 'B1', steps: 1 });
  });

  it('sem materiais: nada a mostrar', () => {
    expect(levelEvolution([])).toEqual({
      points: [],
      first: null,
      latest: null,
      steps: 0,
    });
  });
});

describe('formatInTimeZone', () => {
  it('o mesmo instante cai em dias diferentes conforme o fuso', () => {
    const iso = '2026-10-01T00:05:00.000Z';

    expect(formatInTimeZone(iso, 'UTC')).toBe('01/10/2026');
    expect(formatInTimeZone(iso, 'America/Sao_Paulo', { withTime: true })).toBe(
      '30/09/2026, 21:05',
    );
  });
});
