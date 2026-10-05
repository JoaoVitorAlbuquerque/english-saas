import { describe, expect, it } from 'vitest';

import { diffVersions, flattenContent, type DiffVersion } from './version-diff';

const MAYA = '11111111-1111-4111-8111-111111111111';

function version(overrides: Partial<DiffVersion> = {}): DiffVersion {
  return {
    title: 'Nice to meet you',
    objective: 'Se apresentar.',
    cefrLevel: 'A1',
    estimatedMinutes: 10,
    targetSkills: [{ skillId: 'grammar.be', position: 0 }],
    steps: [
      {
        order: 0,
        type: 'SCENE',
        content: {
          location: 'Corredor',
          characterIds: [MAYA],
          lines: [
            { characterId: MAYA, text: 'Hi!', translation: 'Oi!', spans: [] },
          ],
        },
      },
      { order: 1, type: 'SUMMARY', content: { takeaways: ['I am'] } },
    ],
    ...overrides,
  };
}

describe('diffVersions', () => {
  it('versões iguais: nada mudou', () => {
    const diff = diffVersions(version(), version());

    expect(diff.isEmpty).toBe(true);
    expect(diff.unchangedSteps).toBe(2);
  });

  it('metadados: antes → depois, só do que mudou', () => {
    const diff = diffVersions(
      version(),
      version({ title: 'Meeting people', estimatedMinutes: 15 }),
    );

    expect(diff.meta).toEqual([
      { field: 'title', before: 'Nice to meet you', after: 'Meeting people' },
      { field: 'estimatedMinutes', before: '10', after: '15' },
    ]);
  });

  it('skills-alvo adicionadas e removidas', () => {
    const diff = diffVersions(
      version(),
      version({
        targetSkills: [
          { skillId: 'grammar.be', position: 0 },
          { skillId: 'chunk.nice-to-meet-you', position: 1 },
        ],
      }),
    );

    expect(diff.skillsAdded).toEqual(['chunk.nice-to-meet-you']);
    expect(diff.skillsRemoved).toEqual([]);

    const reverse = diffVersions(
      version({ targetSkills: [{ skillId: 'a.b', position: 0 }] }),
      version(),
    );

    expect(reverse.skillsAdded).toEqual(['grammar.be']);
    expect(reverse.skillsRemoved).toEqual(['a.b']);
  });

  it('etapa alterada lista os campos que mudaram', () => {
    const changed = version();
    const scene = changed.steps[0];

    if (scene === undefined) {
      throw new Error('fixture');
    }

    const diff = diffVersions(version(), {
      ...changed,
      steps: [
        {
          ...scene,
          content: {
            location: 'Corredor',
            characterIds: [MAYA],
            lines: [
              {
                characterId: MAYA,
                text: 'Hello!',
                translation: 'Oi!',
                spans: [],
              },
            ],
          },
        },
        ...changed.steps.slice(1),
      ],
    });

    expect(diff.steps).toEqual([
      {
        kind: 'changed',
        position: 0,
        type: 'SCENE',
        typeChange: null,
        fields: [{ path: 'lines.0.text', before: 'Hi!', after: 'Hello!' }],
      },
    ]);
    expect(diff.unchangedSteps).toBe(1);
  });

  it('etapa nova e etapa removida', () => {
    const base = version();
    const added = diffVersions(base, {
      ...base,
      steps: [
        ...base.steps,
        {
          order: 2,
          type: 'PRACTICE',
          content: { itemIds: [], shuffle: false },
        },
      ],
    });

    expect(added.steps).toEqual([
      { kind: 'added', position: 2, type: 'PRACTICE' },
    ]);

    const removed = diffVersions(base, {
      ...base,
      steps: base.steps.slice(0, 1),
    });

    expect(removed.steps).toEqual([
      { kind: 'removed', position: 1, type: 'SUMMARY' },
    ]);
  });

  it('troca de tipo na mesma posição é registrada', () => {
    const base = version();
    const diff = diffVersions(base, {
      ...base,
      steps: [
        base.steps[0] as DiffVersion['steps'][number],
        {
          order: 1,
          type: 'PRACTICE',
          content: { itemIds: [], shuffle: false },
        },
      ],
    });

    expect(diff.steps[0]).toMatchObject({
      kind: 'changed',
      position: 1,
      typeChange: { from: 'SUMMARY', to: 'PRACTICE' },
    });
  });

  it('ignora a ordem em que as etapas chegam', () => {
    const base = version();
    const shuffled = { ...base, steps: [...base.steps].reverse() };

    expect(diffVersions(base, shuffled).isEmpty).toBe(true);
  });

  it('marcação mudada aparece como texto legível', () => {
    const base = version();
    const scene = base.steps[0] as DiffVersion['steps'][number];
    const withSpan = {
      ...base,
      steps: [
        {
          ...scene,
          content: {
            location: 'Corredor',
            characterIds: [MAYA],
            lines: [
              {
                characterId: MAYA,
                text: 'Hi!',
                translation: 'Oi!',
                spans: [
                  { start: 0, end: 2, kind: 'GRAMMAR', skillId: 'grammar.be' },
                ],
              },
            ],
          },
        },
        ...base.steps.slice(1),
      ],
    };
    const diff = diffVersions(base, withSpan);
    const step = diff.steps[0];

    expect(step).toMatchObject({ kind: 'changed' });
    expect(step?.kind === 'changed' && step.fields).toEqual([
      {
        path: 'lines.0.spans',
        before: '',
        after: 'GRAMMAR 0–2 (grammar.be)',
      },
    ]);
  });
});

describe('flattenContent', () => {
  it('lista de textos vira um campo só; lista de objetos, um campo por item', () => {
    const flat = flattenContent({
      itemIds: ['a', 'b'],
      cards: [{ title: 'um' }, { title: 'dois' }],
      shuffle: true,
    });

    expect(Object.fromEntries(flat)).toEqual({
      itemIds: 'a, b',
      'cards.0.title': 'um',
      'cards.1.title': 'dois',
      shuffle: 'true',
    });
  });
});
