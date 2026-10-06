import { randomUUID } from 'node:crypto';

import {
  clampDifficulty,
  initialDifficulty,
  resolveDifficulty,
} from './domain/difficulty';
import { checkImage } from './domain/image-upload';
import { collectStepReferences, missingReferences } from './domain/references';
import { planReorder, temporaryOrderBase } from './domain/reorder';
import { matchesSearch } from './domain/search';
import { findPrerequisiteCycle } from './domain/skill-graph';
import {
  canPublish,
  clearsApproval,
  isEditable,
  nextStatus,
  nextVersionNumber,
  statusAfterEdit,
} from './domain/versioning';

const MAYA = randomUUID();
const LUCAS = randomUUID();
const AUDIO = randomUUID();
const ITEM = randomUUID();

// ---------------------------------------------------------------------------
// Dificuldade
// ---------------------------------------------------------------------------

describe('dificuldade', () => {
  it('deriva do nível', () => {
    expect(initialDifficulty('A1')).toBe(-2);
    expect(initialDifficulty('B1')).toBe(0);
    expect(initialDifficulty('C1')).toBe(2);
  });

  it('prende nas bordas da escala', () => {
    expect(clampDifficulty(99)).toBe(4);
    expect(clampDifficulty(-99)).toBe(-4);
  });

  it('cai para o valor do nível quando o autor não informa', () => {
    expect(resolveDifficulty('A2', null)).toBe(-1);
    expect(resolveDifficulty('A2', 0.5)).toBe(0.5);
  });

  it('sobrevive a NaN', () => {
    expect(clampDifficulty(Number.NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Referências
// ---------------------------------------------------------------------------

describe('collectStepReferences', () => {
  it('junta tudo que a lição aponta para fora', () => {
    const references = collectStepReferences([
      {
        type: 'SCENE',
        content: {
          location: 'Austin',
          characterIds: [MAYA],
          lines: [
            {
              characterId: LUCAS,
              text: "I'm from Brazil",
              translation: 'Sou do Brasil',
              audioAssetId: AUDIO,
              spans: [
                { start: 0, end: 8, kind: 'CHUNK', skillId: 'chunk.im-from' },
                {
                  start: 9,
                  end: 15,
                  kind: 'REGISTER',
                  registerNoteId: 'gonna',
                },
              ],
            },
          ],
        },
      },
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
      {
        type: 'FREE_PRODUCTION',
        content: {
          prompt: 'Se apresente para a Maya.',
          helpers: [],
          rubric: [
            {
              id: 'no-have-age',
              description: 'Não usa "I have X years"',
              errorPatternId: 'l1.have-for-age',
            },
          ],
          targetSkillIds: ['grammar.be.present.affirmative'],
        },
      },
    ]);

    expect(references.characterIds).toEqual([LUCAS, MAYA].sort());
    expect(references.assetIds).toEqual([AUDIO]);
    expect(references.itemIds).toEqual([ITEM]);
    expect(references.registerNoteIds).toEqual(['gonna']);
    expect(references.errorPatternIds).toEqual(['l1.have-for-age']);
    expect(references.skillIds).toEqual([
      'chunk.im-from',
      'grammar.be.present.affirmative',
    ]);
  });

  it('não repete id', () => {
    const references = collectStepReferences([
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
    ]);

    expect(references.itemIds).toEqual([ITEM]);
  });
});

describe('missingReferences', () => {
  it('aponta o que não existe', () => {
    expect(missingReferences(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
  });

  it('lista vazia quando está tudo lá', () => {
    expect(missingReferences(['a'], ['a', 'b'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Versionamento
// ---------------------------------------------------------------------------

describe('nextStatus', () => {
  it('segue o fluxo até publicar', () => {
    expect(nextStatus('DRAFT', 'submit')).toBe('IN_REVIEW');
    expect(nextStatus('IN_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextStatus('APPROVED', 'publish')).toBe('PUBLISHED');
  });

  it('não deixa publicar direto do rascunho', () => {
    expect(nextStatus('DRAFT', 'publish')).toBeNull();
    expect(nextStatus('IN_REVIEW', 'publish')).toBeNull();
  });

  it('não deixa aprovar um rascunho', () => {
    expect(nextStatus('DRAFT', 'approve')).toBeNull();
  });

  it('devolve para rascunho quando a revisão recusa', () => {
    expect(nextStatus('IN_REVIEW', 'reject')).toBe('DRAFT');
    expect(nextStatus('APPROVED', 'reject')).toBe('DRAFT');
  });

  it('arquiva de qualquer estado vivo', () => {
    expect(nextStatus('PUBLISHED', 'archive')).toBe('ARCHIVED');
    expect(nextStatus('ARCHIVED', 'archive')).toBeNull();
  });

  it('canPublish só vale para APPROVED', () => {
    expect(canPublish('APPROVED')).toBe(true);
    expect(canPublish('IN_REVIEW')).toBe(false);
  });
});

describe('statusAfterEdit', () => {
  it('derruba a revisão de volta para rascunho', () => {
    expect(statusAfterEdit('IN_REVIEW')).toBe('DRAFT');
    expect(statusAfterEdit('APPROVED')).toBe('DRAFT');
    expect(clearsApproval('APPROVED')).toBe(true);
  });

  it('não mexe em quem já é rascunho', () => {
    expect(statusAfterEdit('DRAFT')).toBe('DRAFT');
    expect(clearsApproval('DRAFT')).toBe(false);
  });

  it('publicado e arquivado não se editam no lugar', () => {
    expect(isEditable('PUBLISHED')).toBe(false);
    expect(isEditable('ARCHIVED')).toBe(false);
    expect(isEditable('APPROVED')).toBe(true);
  });
});

describe('nextVersionNumber', () => {
  it('começa em 1', () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it('continua da maior, mesmo fora de ordem', () => {
    expect(nextVersionNumber([1, 3, 2])).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Reordenar
// ---------------------------------------------------------------------------

describe('planReorder', () => {
  it('devolve a ordem nova como 0..n-1', () => {
    const plan = planReorder(['a', 'b', 'c'], ['c', 'a', 'b']);

    expect(plan).toEqual({
      ok: true,
      steps: [
        { id: 'c', order: 0 },
        { id: 'a', order: 1 },
        { id: 'b', order: 2 },
      ],
    });
  });

  it('é estável: a mesma ordem pedida dá o mesmo plano', () => {
    const ids = ['x', 'y', 'z'];

    expect(planReorder(ids, ids)).toEqual(planReorder(ids, [...ids]));
  });

  it('recusa lista vazia', () => {
    const plan = planReorder(['a'], []);

    expect(plan).toMatchObject({ ok: false, reason: 'EMPTY', missing: ['a'] });
  });

  it('recusa id repetido', () => {
    expect(planReorder(['a', 'b'], ['a', 'a', 'b'])).toMatchObject({
      ok: false,
      reason: 'DUPLICATE',
    });
  });

  it('recusa quando falta alguém do conjunto atual', () => {
    expect(planReorder(['a', 'b', 'c'], ['a', 'b'])).toMatchObject({
      ok: false,
      reason: 'MISMATCH',
      missing: ['c'],
      unknown: [],
    });
  });

  it('recusa id que não é irmão', () => {
    expect(planReorder(['a', 'b'], ['a', 'b', 'x'])).toMatchObject({
      ok: false,
      reason: 'MISMATCH',
      unknown: ['x'],
    });
  });
});

describe('temporaryOrderBase', () => {
  it('fica acima de qualquer order atual, mesmo com buraco', () => {
    expect(temporaryOrderBase([0, 5, 9])).toBe(10);
  });

  it('sem irmãos começa em 0', () => {
    expect(temporaryOrderBase([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Busca de texto
// ---------------------------------------------------------------------------

describe('matchesSearch', () => {
  it('ignora acento e caixa', () => {
    expect(matchesSearch(['Pedir um café'], 'CAFE')).toBe(true);
    expect(matchesSearch(['vocab.cafe'], 'café')).toBe(true);
  });

  it('exige todos os termos, em qualquer ordem', () => {
    expect(matchesSearch(['Verbo to be no presente'], 'presente verbo')).toBe(
      true,
    );
    expect(matchesSearch(['Verbo to be no presente'], 'verbo futuro')).toBe(
      false,
    );
  });

  it('busca vazia casa com tudo', () => {
    expect(matchesSearch(['qualquer'], '   ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Imagem enviada
// ---------------------------------------------------------------------------

describe('checkImage', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
  ]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
  ]);

  it('reconhece JPEG, PNG e WebP pelos primeiros bytes', () => {
    expect(checkImage(jpeg)).toMatchObject({
      ok: true,
      type: { mimeType: 'image/jpeg' },
    });
    expect(checkImage(png)).toMatchObject({
      ok: true,
      type: { mimeType: 'image/png' },
    });
    expect(checkImage(webp)).toMatchObject({
      ok: true,
      type: { mimeType: 'image/webp' },
    });
  });

  it('recusa SVG, GIF e texto', () => {
    expect(checkImage(Buffer.from('<svg></svg>'))).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_TYPE',
    });
    expect(checkImage(Buffer.from('GIF89a......'))).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_TYPE',
    });
  });

  it('recusa vazio e acima do teto', () => {
    expect(checkImage(undefined)).toEqual({ ok: false, reason: 'MISSING' });
    expect(checkImage(Buffer.alloc(0))).toEqual({
      ok: false,
      reason: 'MISSING',
    });
    expect(checkImage(png, 4)).toEqual({ ok: false, reason: 'TOO_LARGE' });
  });
});

// ---------------------------------------------------------------------------
// Pré-requisitos entre skills
// ---------------------------------------------------------------------------

describe('findPrerequisiteCycle', () => {
  const edges = (entries: Record<string, string[]>) =>
    new Map(Object.entries(entries));

  it('aceita pré-requisitos que não voltam para a skill', () => {
    expect(
      findPrerequisiteCycle('c', ['b'], edges({ b: ['a'], a: [] })),
    ).toBeNull();
  });

  it('aceita a lista vazia', () => {
    expect(findPrerequisiteCycle('a', [], edges({}))).toBeNull();
  });

  it('pega a auto-referência', () => {
    expect(findPrerequisiteCycle('a', ['a'], edges({}))).toEqual(['a', 'a']);
  });

  it('pega o ciclo direto (A exige B, B exige A)', () => {
    expect(findPrerequisiteCycle('a', ['b'], edges({ b: ['a'] }))).toEqual([
      'a',
      'b',
      'a',
    ]);
  });

  it('pega o ciclo indireto e devolve o caminho todo', () => {
    expect(
      findPrerequisiteCycle(
        'a',
        ['b'],
        edges({ b: ['c'], c: ['d'], d: ['a'] }),
      ),
    ).toEqual(['a', 'b', 'c', 'd', 'a']);
  });

  it('ignora o que a skill exige hoje: está sendo substituído', () => {
    // `a` exige `b` agora; trocar por `c` não fecha ciclo, mesmo `b` exigindo `a`.
    expect(
      findPrerequisiteCycle('a', ['c'], edges({ a: ['b'], b: ['a'], c: [] })),
    ).toBeNull();
  });

  it('não entra em laço quando o grafo já tem um ciclo antigo', () => {
    expect(
      findPrerequisiteCycle('z', ['x'], edges({ x: ['y'], y: ['x'] })),
    ).toBeNull();
  });

  it('aceita um diamante (dois caminhos até a mesma skill)', () => {
    expect(
      findPrerequisiteCycle(
        'top',
        ['left', 'right'],
        edges({ left: ['base'], right: ['base'], base: [] }),
      ),
    ).toBeNull();
  });
});
