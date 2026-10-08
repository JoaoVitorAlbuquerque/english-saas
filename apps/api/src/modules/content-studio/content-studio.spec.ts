import { randomUUID } from 'node:crypto';

import {
  buildSilentWav,
  estimateDurationMs,
} from 'src/infra/tts/fake-tts.provider';

import { audioHash, normalizeAudioText } from './domain/audio-hash';
import {
  collectItemSegments,
  collectStepSegments,
  englishOf,
} from './domain/content-text';
import { checkConsistency, checkItemConsistency } from './domain/consistency';
import {
  findOccurrences,
  mapDraftItem,
  resolveSpans,
  type MarkedSpan,
} from './domain/draft-mapping';
import {
  checkLevel,
  exceedsLevelBudget,
  hasUsefulCoverage,
  lookupWord,
  tokenizeEnglish,
} from './domain/level-check';
import {
  blockers,
  hasBlockers,
  sortWarnings,
  summarize,
  warn,
} from './domain/qa-report';
import { estimateDraftCost } from './domain/draft-cost';
import {
  isAudioKey,
  itemAudioKey,
  missingAudio,
  noteAudioKey,
  planAudioTargets,
  registerNoteIdsInSteps,
  sceneLineKey,
} from './domain/tts-plan';

const MAYA = randomUUID();
const LUCAS = randomUUID();
const ASSET = randomUUID();
const ITEM = randomUUID();

// ---------------------------------------------------------------------------
// Checagem de nível
// ---------------------------------------------------------------------------

describe('tokenizeEnglish', () => {
  it('quebra em palavras e ignora pontuação', () => {
    expect(tokenizeEnglish('Hi! Are you new here?')).toEqual([
      'hi',
      'are',
      'you',
      'new',
      'here',
    ]);
  });

  it('desfaz contração', () => {
    expect(tokenizeEnglish("I'm from Brazil")).toEqual(['i', 'am', 'from']);
  });

  it('descarta nome próprio no meio da frase', () => {
    // "Brazil" e "Campinas" não são vocabulário a cobrar do aluno.
    expect(tokenizeEnglish('I live in Campinas')).toEqual(['i', 'live', 'in']);
  });

  it('mantém a primeira palavra da frase, mesmo maiúscula', () => {
    expect(tokenizeEnglish('Welcome to Austin!')).toEqual(['welcome', 'to']);
  });

  it('mantém o pronome I', () => {
    expect(tokenizeEnglish('She and I are here.')).toEqual([
      'she',
      'and',
      'i',
      'are',
      'here',
    ]);
  });

  it('ignora número', () => {
    expect(tokenizeEnglish('I am 24')).toEqual(['i', 'am']);
  });
});

describe('lookupWord', () => {
  it('acha a palavra exata', () => {
    expect(lookupWord('friendly')?.band).toBe('A1');
  });

  it('desfaz plural', () => {
    expect(lookupWord('books')?.word).toBe('book');
  });

  it('desfaz -ing com "e" mudo', () => {
    expect(lookupWord('living')?.word).toBe('live');
  });

  it('desfaz -ly', () => {
    expect(lookupWord('nicely')?.word).toBe('nice');
  });

  it('devolve undefined para palavra fora da lista', () => {
    expect(lookupWord('xylophone')).toBeUndefined();
  });
});

describe('checkLevel', () => {
  it('não acusa texto dentro do nível', () => {
    const result = checkLevel('I am from Brazil. She is my friend.', 'A1');

    expect(result.outOfLevelCount).toBe(0);
    expect(result.ratio).toBe(0);
  });

  it('acusa palavra acima do nível', () => {
    const result = checkLevel('It is good, albeit cold.', 'A1');

    expect(result.outOfLevel.map((entry) => entry.word)).toContain('albeit');
    expect(result.ratio).toBeGreaterThan(0);
  });

  it('não acusa a mesma palavra no nível dela', () => {
    expect(checkLevel('It is good, albeit cold.', 'C1').outOfLevelCount).toBe(
      0,
    );
  });

  it('palavra fora da lista não conta como fora do nível', () => {
    const result = checkLevel('I am a xylophone.', 'A1');

    expect(result.unknown).toContain('xylophone');
    expect(result.outOfLevelCount).toBe(0);
    expect(result.coverage).toBeLessThan(1);
  });

  it('sobrevive a texto vazio', () => {
    const result = checkLevel('', 'A1');

    expect(result.totalWords).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.coverage).toBe(1);
  });
});

describe('exceedsLevelBudget', () => {
  /**
   * O teto é sobre o conjunto, não sobre a frase. Uma palavra difícil bem
   * contextualizada é permitida de propósito — é assim que o aluno cresce.
   */
  it('não acusa uma palavra difícil perdida num texto longo', () => {
    const text = `${'I am from Brazil. She is my friend. '.repeat(10)} It is good, albeit cold.`;
    const stats = checkLevel(text, 'A1');

    expect(stats.outOfLevel.map((entry) => entry.word)).toContain('albeit');
    expect(exceedsLevelBudget(stats, 0.05)).toBe(false);
  });

  it('acusa quando as difíceis passam do teto', () => {
    const stats = checkLevel(
      'Actually it is quite good, though apparently albeit cold.',
      'A1',
    );

    expect(exceedsLevelBudget(stats, 0.05)).toBe(true);
  });

  it('teto zero acusa qualquer palavra fora do nível', () => {
    const stats = checkLevel('It is good, albeit cold.', 'A1');

    expect(exceedsLevelBudget(stats, 0)).toBe(true);
  });
});

describe('hasUsefulCoverage', () => {
  it('texto coberto pela lista é confiável', () => {
    expect(hasUsefulCoverage(checkLevel('I am from Brazil.', 'A1'))).toBe(true);
  });

  it('texto cheio de palavra desconhecida não é', () => {
    const stats = checkLevel(
      'Xylophone marimba vibraphone glockenspiel.',
      'A1',
    );

    expect(hasUsefulCoverage(stats)).toBe(false);
  });

  it('texto vazio não é reclamado', () => {
    expect(hasUsefulCoverage(checkLevel('', 'A1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mapeamento do rascunho
// ---------------------------------------------------------------------------

describe('findOccurrences', () => {
  it('acha todas as posições', () => {
    expect(findOccurrences('ab ab ab', 'ab')).toEqual([0, 3, 6]);
  });

  it('ignora caixa', () => {
    expect(findOccurrences('Nice to meet you', 'nice')).toEqual([0]);
  });

  it('devolve vazio para agulha vazia', () => {
    expect(findOccurrences('abc', '')).toEqual([]);
  });
});

describe('resolveSpans', () => {
  const skill = 'grammar.be.present.affirmative';

  it('acha o trecho e calcula os índices', () => {
    const text = 'Hi! Are you new here?';
    const { spans, warnings } = resolveSpans(text, [
      {
        text: 'Are you new here?',
        occurrence: 1,
        kind: 'GRAMMAR',
        skillId: skill,
      },
    ]);

    expect(warnings).toEqual([]);
    expect(spans[0]).toEqual({
      start: 4,
      end: 21,
      kind: 'GRAMMAR',
      skillId: skill,
    });
    expect(text.slice(spans[0]!.start, spans[0]!.end)).toBe(
      'Are you new here?',
    );
  });

  it('respeita o índice da ocorrência pedida', () => {
    const text = "I'm Lucas. I'm from Brazil.";
    const { spans } = resolveSpans(text, [
      { text: "I'm", occurrence: 2, kind: 'REGISTER', registerNoteId: 'im' },
    ]);

    expect(spans[0]?.start).toBe(11);
  });

  it('a busca parte do fim da marcação anterior', () => {
    const text = "I'm Lucas. I'm from Brazil.";
    const marked: MarkedSpan[] = [
      { text: "I'm", occurrence: 1, kind: 'REGISTER', registerNoteId: 'im' },
      // A IA pediu a primeira de novo; usar seria sobrepor.
      { text: "I'm", occurrence: 1, kind: 'REGISTER', registerNoteId: 'im' },
    ];

    const { spans, warnings } = resolveSpans(text, marked);

    expect(warnings).toEqual([]);
    expect(spans.map((span) => span.start)).toEqual([0, 11]);
  });

  it('avisa em vez de quebrar quando o trecho não existe', () => {
    const { spans, warnings } = resolveSpans('Hi there.', [
      {
        text: 'Are you new here?',
        occurrence: 1,
        kind: 'GRAMMAR',
        skillId: skill,
      },
    ]);

    expect(spans).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('SPAN_TEXT_NOT_FOUND');
    expect(warnings[0]?.severity).toBe('WARNING');
  });

  it('avisa quando só sobram ocorrências antes da marcação anterior', () => {
    const text = "I'm Lucas. Nice to meet you.";
    const { spans, warnings } = resolveSpans(text, [
      {
        text: 'Nice to meet you',
        occurrence: 1,
        kind: 'CHUNK',
        skillId: skill,
      },
      { text: "I'm", occurrence: 1, kind: 'REGISTER', registerNoteId: 'im' },
    ]);

    expect(spans).toHaveLength(1);
    expect(warnings[0]?.code).toBe('SPAN_TEXT_NOT_FOUND');
  });

  it('usa a primeira ocorrência quando a IA não informa o índice', () => {
    const { spans } = resolveSpans('ab ab', [
      { text: 'ab', occurrence: null, kind: 'VOCAB' },
    ]);

    expect(spans[0]?.start).toBe(0);
  });

  it('cai para a próxima ocorrência quando a pedida não existe', () => {
    const { spans, warnings } = resolveSpans('ab ab', [
      { text: 'ab', occurrence: 9, kind: 'VOCAB' },
    ]);

    expect(warnings).toEqual([]);
    expect(spans[0]?.start).toBe(0);
  });
});

describe('mapDraftItem', () => {
  const base = {
    prompt: 'Complete.',
    explanation: 'Porque sim.',
    skillIds: ['grammar.be'],
  };

  it('monta múltipla escolha e zera acceptedAnswers', () => {
    const mapped = mapDraftItem({
      ...base,
      type: 'MULTIPLE_CHOICE',
      options: [{ id: 'a', text: 'am' }],
      correctOptionIds: ['a'],
      acceptedAnswers: ['am'],
    });

    // Em tipo de escolha o gabarito vive no conteúdo; o módulo 4 recusa
    // acceptedAnswers preenchido.
    expect(mapped.acceptedAnswers).toEqual([]);
    expect(mapped.content['correctOptionIds']).toEqual(['a']);
  });

  it('monta item de escuta sem áudio ainda', () => {
    const mapped = mapDraftItem({
      ...base,
      type: 'LISTEN_CHOOSE',
      audioText: "He's friendly.",
      options: [{ id: 'a', text: "He's friendly." }],
      correctOptionIds: ['a'],
    });

    expect(mapped.content['audioText']).toBe("He's friendly.");
    expect(mapped.content['audioAssetId']).toBeNull();
  });

  it('converte a lista de erros em mapa', () => {
    const mapped = mapDraftItem({
      ...base,
      type: 'TYPE_ANSWER',
      acceptedAnswers: ["I'm 20 years old"],
      errorPatterns: [
        { wrongAnswer: 'I have 20 years', errorPatternId: 'l1.have-for-age' },
      ],
    });

    expect(mapped.errorPatternMap).toEqual({
      'I have 20 years': 'l1.have-for-age',
    });
  });

  it('preserva a resposta nos tipos digitados', () => {
    const mapped = mapDraftItem({
      ...base,
      type: 'ORDER_WORDS',
      tokens: ['am', 'I', 'Lucas'],
      acceptedAnswers: ['I am Lucas'],
    });

    expect(mapped.acceptedAnswers).toEqual(['I am Lucas']);
    expect(mapped.content['tokens']).toEqual(['am', 'I', 'Lucas']);
  });
});

// ---------------------------------------------------------------------------
// Consistência
// ---------------------------------------------------------------------------

describe('checkItemConsistency', () => {
  const base = {
    id: ITEM,
    prompt: 'x',
    skillIds: ['grammar.be'],
  };

  it('aceita ORDER_WORDS cujas peças montam a resposta', () => {
    expect(
      checkItemConsistency(
        {
          ...base,
          type: 'ORDER_WORDS',
          content: { tokens: ['from', "I'm", 'Brazil'] },
          acceptedAnswers: ["I'm from Brazil"],
          explanation: 'x',
        },
        'items.0',
      ),
    ).toEqual([]);
  });

  it('aceita peças com contração contra resposta expandida', () => {
    expect(
      checkItemConsistency(
        {
          ...base,
          type: 'ORDER_WORDS',
          content: { tokens: ['from', "I'm", 'Brazil'] },
          acceptedAnswers: ['I am from Brazil'],
          explanation: 'x',
        },
        'items.0',
      ),
    ).toEqual([]);
  });

  it('barra ORDER_WORDS cujas peças não montam a resposta', () => {
    const issues = checkItemConsistency(
      {
        ...base,
        type: 'ORDER_WORDS',
        content: { tokens: ['from', 'you', 'Brazil'] },
        acceptedAnswers: ["I'm from Brazil"],
        explanation: 'x',
      },
      'items.0',
    );

    expect(issues[0]?.code).toBe('ORDER_WORDS_TOKENS_MISMATCH');
    expect(issues[0]?.severity).toBe('BLOCKER');
  });

  it('barra FILL_BLANK com lacuna a mais', () => {
    const issues = checkItemConsistency(
      {
        ...base,
        type: 'FILL_BLANK',
        content: { sentence: 'I ___ from ___.' },
        acceptedAnswers: ['am'],
        explanation: 'x',
      },
      'items.0',
    );

    expect(issues[0]?.code).toBe('FILL_BLANK_COUNT_MISMATCH');
    expect(issues[0]?.severity).toBe('BLOCKER');
  });

  it('avisa (sem barrar) quando a explicação não cita a alternativa certa', () => {
    const issues = checkItemConsistency(
      {
        ...base,
        type: 'MULTIPLE_CHOICE',
        content: {
          options: [
            { id: 'a', text: 'am' },
            { id: 'b', text: 'is' },
          ],
          correctOptionIds: ['a'],
        },
        acceptedAnswers: [],
        explanation: 'Use a forma certa do verbo.',
      },
      'items.0',
    );

    expect(issues[0]?.code).toBe('ANSWER_EXPLANATION_MISMATCH');
    expect(issues[0]?.severity).toBe('INFO');
  });

  it('não avisa quando a explicação cita a alternativa certa', () => {
    expect(
      checkItemConsistency(
        {
          ...base,
          type: 'MULTIPLE_CHOICE',
          content: {
            options: [
              { id: 'a', text: 'am' },
              { id: 'b', text: 'is' },
            ],
            correctOptionIds: ['a'],
          },
          acceptedAnswers: [],
          explanation: 'Com "I", a forma é "am".',
        },
        'items.0',
      ),
    ).toEqual([]);
  });

  it('barra item de escolha sem gabarito', () => {
    const issues = checkItemConsistency(
      {
        ...base,
        type: 'MULTIPLE_CHOICE',
        content: { options: [{ id: 'a', text: 'am' }], correctOptionIds: [] },
        acceptedAnswers: [],
        explanation: 'x',
      },
      'items.0',
    );

    expect(issues[0]?.code).toBe('ITEM_WITHOUT_ANSWER');
  });
});

describe('checkConsistency', () => {
  const scene = {
    type: 'SCENE' as const,
    content: {
      location: 'Austin',
      characterIds: [MAYA],
      lines: [
        {
          characterId: MAYA,
          text: "I'm Maya.",
          translation: 'Eu sou a Maya.',
          spans: [
            {
              start: 0,
              end: 3,
              kind: 'GRAMMAR' as const,
              skillId: 'grammar.be',
            },
          ],
        },
      ],
    },
  };

  it('não reclama quando a skill é ensinada e medida', () => {
    expect(
      checkConsistency({
        targetSkillIds: ['grammar.be'],
        steps: [scene],
        items: [
          {
            id: ITEM,
            type: 'TYPE_ANSWER',
            prompt: 'x',
            content: {},
            acceptedAnswers: ['I am Maya'],
            explanation: 'x',
            skillIds: ['grammar.be'],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('avisa quando a skill não aparece marcada', () => {
    const warnings = checkConsistency({
      targetSkillIds: ['chunk.nice'],
      steps: [scene],
      items: [
        {
          id: ITEM,
          type: 'TYPE_ANSWER',
          prompt: 'x',
          content: {},
          acceptedAnswers: ['x'],
          explanation: 'x',
          skillIds: ['chunk.nice'],
        },
      ],
    });

    expect(warnings.map((w) => w.code)).toEqual(['SKILL_NOT_IN_SPANS']);
  });

  it('avisa quando nenhum item mede a skill', () => {
    const warnings = checkConsistency({
      targetSkillIds: ['grammar.be'],
      steps: [scene],
      items: [],
    });

    expect(warnings.map((w) => w.code)).toEqual(['SKILL_NOT_IN_ITEMS']);
  });
});

// ---------------------------------------------------------------------------
// Relatório de QA
// ---------------------------------------------------------------------------

describe('qa-report', () => {
  it('a gravidade vem do catálogo, não de quem cria o aviso', () => {
    expect(warn('LEVEL_ABOVE_TARGET', 'x').severity).toBe('WARNING');
    expect(warn('ORDER_WORDS_TOKENS_MISMATCH', 'x').severity).toBe('BLOCKER');
    expect(warn('ANSWER_EXPLANATION_MISMATCH', 'x').severity).toBe('INFO');
  });

  it('conta por gravidade', () => {
    const warnings = [
      warn('LEVEL_ABOVE_TARGET', 'a'),
      warn('ORDER_WORDS_TOKENS_MISMATCH', 'b'),
      warn('ANSWER_EXPLANATION_MISMATCH', 'c'),
    ];

    expect(summarize(warnings)).toEqual({
      blockerCount: 1,
      warningCount: 1,
      infoCount: 1,
    });
    expect(hasBlockers(warnings)).toBe(true);
    expect(blockers(warnings)).toHaveLength(1);
  });

  it('não vê bloqueador onde não há', () => {
    expect(hasBlockers([warn('LEVEL_LOW_COVERAGE', 'x')])).toBe(false);
  });

  it('ordena colocando o que trava primeiro', () => {
    const sorted = sortWarnings([
      warn('ANSWER_EXPLANATION_MISMATCH', 'c'),
      warn('ORDER_WORDS_TOKENS_MISMATCH', 'b'),
      warn('LEVEL_ABOVE_TARGET', 'a'),
    ]);

    expect(sorted.map((w) => w.severity)).toEqual([
      'BLOCKER',
      'WARNING',
      'INFO',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Áudio
// ---------------------------------------------------------------------------

describe('audioHash', () => {
  it('caixa e espaço não mudam o áudio', () => {
    expect(audioHash({ text: "I'm Maya.", voiceId: 'v1' })).toBe(
      audioHash({ text: "  i'm   maya.  ", voiceId: 'v1' }),
    );
  });

  it('pontuação muda', () => {
    expect(audioHash({ text: 'Nice to meet you.', voiceId: 'v1' })).not.toBe(
      audioHash({ text: 'Nice to meet you?', voiceId: 'v1' }),
    );
  });

  it('voz diferente muda', () => {
    expect(audioHash({ text: 'Hi.', voiceId: 'v1' })).not.toBe(
      audioHash({ text: 'Hi.', voiceId: 'v2' }),
    );
  });

  it('velocidade diferente muda', () => {
    expect(
      audioHash({ text: 'Hi.', voiceId: 'v1', speakingRate: 0.9 }),
    ).not.toBe(audioHash({ text: 'Hi.', voiceId: 'v1', speakingRate: 1 }));
  });

  it('o sal força outro áudio; sem sal o hash é o de sempre', () => {
    const base = { text: 'Hi.', voiceId: 'v1' };

    expect(audioHash({ ...base, salt: 'a' })).not.toBe(audioHash(base));
    expect(audioHash({ ...base, salt: 'a' })).not.toBe(
      audioHash({ ...base, salt: 'b' }),
    );
    expect(audioHash({ ...base, salt: undefined })).toBe(audioHash(base));
  });

  it('aspa curva vale como reta', () => {
    expect(normalizeAudioText('I’m')).toBe("i'm");
  });
});

describe('FakeTtsProvider', () => {
  it('gera um WAV com cabeçalho válido', () => {
    const wav = buildSilentWav(1_000);

    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.readUInt32LE(4)).toBe(wav.byteLength - 8);
  });

  it('a duração acompanha o tamanho do texto', () => {
    expect(estimateDurationMs('Hi.')).toBeLessThan(
      estimateDurationMs('This is a much longer sentence to say out loud.'),
    );
  });

  it('respeita um piso de duração', () => {
    expect(estimateDurationMs('')).toBe(300);
  });

  it('fala mais devagar dura mais', () => {
    expect(estimateDurationMs('Nice to meet you.', 0.5)).toBeGreaterThan(
      estimateDurationMs('Nice to meet you.', 1),
    );
  });
});

describe('planAudioTargets', () => {
  const steps = [
    {
      type: 'SCENE' as const,
      content: {
        location: 'Austin',
        characterIds: [MAYA, LUCAS],
        lines: [
          {
            characterId: MAYA,
            text: 'Hi!',
            translation: 'Oi!',
            audioAssetId: ASSET,
            spans: [],
          },
          {
            characterId: LUCAS,
            text: "I'm Lucas.",
            translation: 'Eu sou o Lucas.',
            spans: [],
          },
        ],
      },
    },
  ];

  it('lista as falas e diz quem já tem áudio', () => {
    const targets = planAudioTargets({
      steps,
      voiceByCharacterId: { [MAYA]: 'v-maya', [LUCAS]: null },
      items: [],
      registerNotes: [],
    });

    expect(targets).toHaveLength(2);
    expect(targets[0]?.hasAudio).toBe(true);
    expect(targets[0]?.voiceId).toBe('v-maya');
    // Sem voz no personagem, cai para a voz padrão do ambiente.
    expect(targets[1]?.voiceId).toBe('');
    expect(missingAudio(targets)).toHaveLength(1);
  });

  it('inclui item de escuta e ignora item sem áudio', () => {
    const targets = planAudioTargets({
      steps: [],
      voiceByCharacterId: {},
      items: [
        {
          id: ITEM,
          type: 'LISTEN_CHOOSE',
          content: { audioText: "He's friendly.", audioAssetId: null },
        },
        { id: randomUUID(), type: 'MULTIPLE_CHOICE', content: {} },
      ],
      registerNotes: [],
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.text).toBe("He's friendly.");
    expect(targets[0]?.hasAudio).toBe(false);
  });

  it('inclui nota de registro e respeita a que já tem áudio', () => {
    const targets = planAudioTargets({
      steps: [],
      voiceByCharacterId: {},
      items: [],
      registerNotes: [
        { id: 'gonna', spokenForm: 'gonna', audioAssetId: ASSET },
        { id: 'wanna', spokenForm: 'wanna', audioAssetId: null },
      ],
    });

    expect(missingAudio(targets).map((t) => t.registerNoteId)).toEqual([
      'wanna',
    ]);
  });
});

describe('registerNoteIdsInSteps', () => {
  it('junta as notas marcadas na cena e no resumo', () => {
    const ids = registerNoteIdsInSteps([
      {
        type: 'SCENE',
        content: {
          location: 'x',
          characterIds: [MAYA],
          lines: [
            {
              characterId: MAYA,
              text: "I'm Maya.",
              translation: 'x',
              spans: [
                {
                  start: 0,
                  end: 3,
                  kind: 'REGISTER',
                  registerNoteId: 'im-contraction',
                },
              ],
            },
          ],
        },
      },
      {
        type: 'SUMMARY',
        content: {
          takeaways: ['x'],
          skillIds: [],
          registerNoteIds: ['gonna'],
        },
      },
    ]);

    expect(ids).toEqual(['gonna', 'im-contraction']);
  });
});

// ---------------------------------------------------------------------------
// Extração de texto
// ---------------------------------------------------------------------------

describe('collectStepSegments', () => {
  it('pega a fala com a tradução e o standardText separado', () => {
    const segments = collectStepSegments([
      {
        type: 'SCENE',
        content: {
          location: 'x',
          characterIds: [MAYA],
          lines: [
            {
              characterId: MAYA,
              text: 'You coming?',
              standardText: 'Are you coming?',
              translation: 'Você vem?',
              spans: [],
            },
          ],
        },
      },
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      path: 'steps.0.lines.0',
      english: 'You coming?',
      portuguese: 'Você vem?',
    });
    expect(segments[1]?.path).toBe('steps.0.lines.0.standardText');
  });

  it('não manda enunciado nem explicação, que são pt-BR', () => {
    const segments = collectStepSegments([
      {
        type: 'FREE_PRODUCTION',
        content: {
          prompt: 'Escreva sobre você.',
          helpers: ["I'm from ___."],
          rubric: [{ id: 'a', description: 'Diz o nome.' }],
          targetSkillIds: [],
        },
      },
    ]);

    expect(englishOf(segments)).toEqual(["I'm from ___."]);
  });
});

describe('collectItemSegments', () => {
  it('pega alternativa, frase e resposta aceita', () => {
    const segments = collectItemSegments([
      {
        id: ITEM,
        type: 'FILL_BLANK',
        content: { sentence: 'Biscuit ___ a dog.' },
        acceptedAnswers: ['is'],
      },
    ]);

    expect(englishOf(segments)).toEqual(['Biscuit ___ a dog.', 'is']);
    expect(segments[0]?.path).toBe('items.0.sentence');
  });
});

describe('chaves de áudio', () => {
  it('cada alvo tem uma chave estável e válida', () => {
    expect(sceneLineKey(0, 2)).toBe('scene:0:2');
    expect(itemAudioKey(ITEM)).toBe(`item:${ITEM}`);
    expect(noteAudioKey('gonna')).toBe('note:gonna');

    for (const key of [
      sceneLineKey(3, 11),
      itemAudioKey(ITEM),
      noteAudioKey('register.gonna'),
    ]) {
      expect(isAudioKey(key)).toBe(true);
    }
  });

  it('recusa o que não é chave', () => {
    for (const key of ['', 'scene:a:1', 'item:123', 'note:', 'x:1:2']) {
      expect(isAudioKey(key)).toBe(false);
    }
  });

  it('planAudioTargets entrega a chave, o personagem e o asset ligado', () => {
    const targets = planAudioTargets({
      steps: [
        {
          type: 'SCENE' as const,
          content: {
            location: 'Austin',
            characterIds: [MAYA],
            lines: [
              {
                characterId: MAYA,
                text: 'Hi!',
                translation: 'Oi!',
                audioAssetId: ASSET,
                spans: [],
              },
            ],
          },
        },
      ],
      voiceByCharacterId: {},
      items: [
        { id: ITEM, type: 'DICTATION', content: { audioText: 'Hello.' } },
      ],
      registerNotes: [{ id: 'gonna', spokenForm: 'gonna', audioAssetId: null }],
    });

    expect(targets.map((target) => target.key)).toEqual([
      'scene:0:0',
      `item:${ITEM}`,
      'note:gonna',
    ]);
    expect(targets[0]).toMatchObject({ characterId: MAYA, assetId: ASSET });
    expect(targets[1]?.assetId).toBeNull();
  });
});

describe('estimateDraftCost', () => {
  const lesson = (costUsdMicros: number | null) => ({
    kind: 'LESSON' as const,
    costUsdMicros,
    count: null,
  });
  const items = (costUsdMicros: number | null, count: number | null) => ({
    kind: 'ITEMS' as const,
    costUsdMicros,
    count,
  });

  it('sem histórico não inventa número', () => {
    expect(estimateDraftCost([], 'LESSON', 1)).toEqual({
      usdMicros: null,
      basedOn: 0,
    });
  });

  it('lição: média dos pedidos de lição', () => {
    expect(
      estimateDraftCost([lesson(40_000), lesson(60_000)], 'LESSON', 1),
    ).toEqual({ usdMicros: 50_000, basedOn: 2 });
  });

  it('questões: custo por questão vezes a quantidade pedida', () => {
    // 10 questões a 20 mil e 5 a 15 mil: 2 mil e 3 mil por questão; média 2.500.
    expect(
      estimateDraftCost([items(20_000, 10), items(15_000, 5)], 'ITEMS', 8),
    ).toEqual({ usdMicros: 20_000, basedOn: 2 });
  });

  it('só olha o mesmo tipo de pedido', () => {
    expect(
      estimateDraftCost([lesson(40_000), items(9_000, 3)], 'ITEMS', 3).basedOn,
    ).toBe(1);
  });

  it('ignora custo zero ou nulo (provedor fake) e contagem ausente', () => {
    expect(
      estimateDraftCost(
        [lesson(0), lesson(null), items(5_000, null), items(5_000, 0)],
        'LESSON',
        1,
      ),
    ).toEqual({ usdMicros: null, basedOn: 0 });
    expect(estimateDraftCost([items(5_000, null)], 'ITEMS', 4).usdMicros).toBe(
      null,
    );
  });
});
