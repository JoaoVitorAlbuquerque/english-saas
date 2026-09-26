import { levelBias, materialLevel, ratingSignal } from './domain/calibration';
import {
  isFactual,
  quoteInSource,
  removeSentences,
  replaceSentence,
  splitSentences,
  unsupportedSentences,
} from './domain/claims';
import {
  answerKeyResponse,
  exerciseMixIssues,
  validateExercise,
  type ExerciseRefs,
  type GeneratedExerciseDraft,
  type ValidExercise,
} from './domain/exercises';
import {
  classifyUrl,
  englishSignal,
  estimateLevel,
  isPrivateAddress,
  longestVerbatimRun,
  looksEnglish,
  overCopiedSentences,
} from './domain/ingest';
import {
  countWords,
  LEVEL_PROFILES,
  shiftLevel,
  wordCountIssue,
} from './domain/level-profile';
import {
  resolveMaterialSpans,
  sanitizeSupporting,
  type MarkedMaterialSpan,
} from './domain/material';
import {
  failRunning,
  initialSteps,
  isDone,
  markStep,
  stepsFor,
} from './domain/steps';
import {
  materialCacheKey,
  pickRegisterNotes,
  pickTargets,
  themeSkills,
  type CatalogSkill,
} from './domain/targets';
import { extractArticle } from './services/article-extract';
import { resolvePublicAddresses } from './services/article-fetcher';

const CATALOG: CatalogSkill[] = [
  { id: 'grammar.be.present.affirmative', type: 'GRAMMAR', cefrLevel: 'A1' },
  { id: 'grammar.articles.a-an', type: 'GRAMMAR', cefrLevel: 'A1' },
  { id: 'chunk.nice-to-meet-you', type: 'CHUNK', cefrLevel: 'A1' },
  { id: 'vocab.numbers-1-20', type: 'VOCAB_SET', cefrLevel: 'A1' },
  { id: 'grammar.past-simple.regular', type: 'GRAMMAR', cefrLevel: 'A2' },
  { id: 'grammar.past-simple.irregular', type: 'GRAMMAR', cefrLevel: 'A2' },
  { id: 'grammar.there-was-were', type: 'GRAMMAR', cefrLevel: 'A2' },
  { id: 'grammar.present-perfect', type: 'GRAMMAR', cefrLevel: 'B1' },
  { id: 'grammar.third-conditional', type: 'GRAMMAR', cefrLevel: 'B2' },
];

const NOTES = [
  { id: 'im-contraction', cefrLevel: 'A1' as const },
  { id: 'gonna', cefrLevel: 'A2' as const },
  { id: 'wanna', cefrLevel: 'A2' as const },
  { id: 'gotta', cefrLevel: 'B1' as const },
];

describe('pickTargets', () => {
  const base = {
    level: 'A2' as const,
    weakSkillIds: [] as string[],
    nextTargetSkillIds: [] as string[],
    themeSkillIds: themeSkills('HISTORY'),
    catalog: CATALOG,
    registerNotes: NOTES,
    seed: '7701',
  };

  it('fraqueza primeiro, e uma vaga para a estrutura do tema', () => {
    const targets = pickTargets({
      ...base,
      weakSkillIds: ['grammar.past-simple.irregular', 'grammar.articles.a-an'],
      nextTargetSkillIds: ['grammar.be.present.affirmative'],
    });

    expect(targets.skillIds).toEqual([
      'grammar.past-simple.irregular',
      'grammar.articles.a-an',
      'grammar.past-simple.regular',
    ]);
  });

  it('sem histórico, o tema preenche; sem tema, as gramáticas do nível', () => {
    expect(pickTargets(base).skillIds).toEqual([
      'grammar.past-simple.irregular',
      'grammar.past-simple.regular',
      'grammar.there-was-were',
    ]);

    // Reserva em ordem de catálogo (id), sem preferência.
    expect(pickTargets({ ...base, themeSkillIds: [] }).skillIds).toEqual([
      'grammar.past-simple.regular',
      'grammar.past-simple.irregular',
    ]);
  });

  it('ignora vocabulário, skill fora do catálogo e nível alto demais', () => {
    const targets = pickTargets({
      ...base,
      weakSkillIds: [
        'vocab.numbers-1-20',
        'grammar.does-not-exist',
        'grammar.third-conditional',
        'grammar.present-perfect',
      ],
    });

    // B1 é "um acima" de A2: entra. B2 não.
    expect(targets.skillIds).toContain('grammar.present-perfect');
    expect(targets.skillIds).not.toContain('grammar.third-conditional');
    expect(targets.skillIds).not.toContain('vocab.numbers-1-20');
    expect(targets.skillIds).not.toContain('grammar.does-not-exist');
  });

  it('é determinístico', () => {
    expect(pickTargets(base)).toEqual(pickTargets(base));
  });

  it('notas de registro: do nível primeiro, nunca acima dele', () => {
    const notes = pickRegisterNotes(NOTES, 'A2', 'seed');
    expect(notes).toHaveLength(2);
    expect(notes).not.toContain('gotta');
    expect(pickRegisterNotes(NOTES, 'A2', 'seed')).toEqual(notes);
    expect(pickRegisterNotes([], 'A2', 'x')).toEqual([]);
  });
});

describe('materialCacheKey', () => {
  const key = {
    pageId: 1,
    revisionId: '99',
    level: 'A2' as const,
    targetSkillIds: ['b', 'a'],
    registerNoteIds: ['gonna'],
    promptVersion: 1,
  };

  it('a ordem dos alvos não muda a chave', () => {
    expect(materialCacheKey(key)).toBe(
      materialCacheKey({ ...key, targetSkillIds: ['a', 'b'] }),
    );
  });

  it('nível, revisão e versão do prompt mudam a chave', () => {
    const original = materialCacheKey(key);
    expect(materialCacheKey({ ...key, level: 'B1' })).not.toBe(original);
    expect(materialCacheKey({ ...key, revisionId: '100' })).not.toBe(original);
    expect(materialCacheKey({ ...key, promptVersion: 2 })).not.toBe(original);
  });
});

describe('checagem de fatos', () => {
  const source =
    'Columbus left the port of Palos in Spain on 3 August 1492. He sailed with three ships.';

  it('a citação precisa existir literalmente (espaço e aspas normalizados)', () => {
    expect(quoteInSource('left the port of  Palos', source)).toBe(true);
    expect(quoteInSource('Columbus traveled with his dog', source)).toBe(false);
    // Curta demais não prova nada.
    expect(quoteInSource('He', source)).toBe(false);
  });

  it('frase com número ou nome sem claim é factual', () => {
    expect(isFactual('In 1492 the ships left.')).toBe(true);
    expect(isFactual('The ships left Spain.')).toBe(true);
    expect(isFactual('The trip was long.')).toBe(false);
    expect(isFactual("Then I'm happy.")).toBe(false);
  });

  it('marca como sem suporte a claim reprovada e o fato sem claim', () => {
    const text =
      'Columbus left Palos in 1492. The trip was long. Columbus had a dog named Leo. The King paid.';
    const claims = [
      { sentence: 'Columbus left Palos in 1492.', sourceQuote: 'x' },
      { sentence: 'Columbus had a dog named Leo.', sourceQuote: 'y' },
    ];

    const bad = unsupportedSentences(text, claims, [true, false]).map(
      (sentence) => sentence.text,
    );

    expect(bad).toEqual(['Columbus had a dog named Leo.', 'The King paid.']);
  });

  it('remove e troca frases sem colar as vizinhas', () => {
    const text = 'One. Two has Leo. Three.';
    const [, two] = splitSentences(text);

    expect(two).toBeDefined();
    expect(removeSentences(text, two === undefined ? [] : [two])).toBe(
      'One. Three.',
    );
    expect(
      replaceSentence(text, two ?? { text: '', start: 0, end: 0 }, 'Two.'),
    ).toBe('One. Two. Three.');
  });

  it('não corta frase em abreviação comum', () => {
    expect(
      splitSentences('Mr. Smith arrived. He was late.').map((s) => s.text),
    ).toEqual(['Mr. Smith arrived.', 'He was late.']);
  });
});

describe('destaques do material', () => {
  const allowed = {
    skillIds: new Set(['grammar.past-simple.irregular']),
    registerNoteIds: new Set(['gonna']),
  };
  const mark = (
    overrides: Partial<MarkedMaterialSpan>,
  ): MarkedMaterialSpan => ({
    text: 'sailed',
    occurrence: 1,
    kind: 'GRAMMAR',
    skillId: 'grammar.past-simple.irregular',
    registerNoteId: null,
    explanationPtBr: 'Passado.',
    ...overrides,
  });

  it('calcula o índice pelo trecho e descarta o que não serve', () => {
    const text = 'He sailed west. They sailed back.';
    const spans = resolveMaterialSpans(
      text,
      [
        mark({ occurrence: 2 }),
        mark({ text: 'sailed', occurrence: 2 }), // sobreposta: cai
        mark({ text: 'Leo' }), // trecho sumiu do texto: cai
        mark({ text: 'west', skillId: 'grammar.invented' }), // id inventado
        mark({ text: 'back', kind: 'VOCAB', skillId: null }),
      ],
      allowed,
    );

    expect(spans.map((span) => text.slice(span.start, span.end))).toEqual([
      'sailed',
      'sailed',
      'back',
    ]);
    expect(spans[0]?.start).toBe(3);
    expect(spans[1]?.start).toBe(text.lastIndexOf('sailed'));
  });

  it('limpa spotlight, nota de registro e vocabulário', () => {
    const cleaned = sanitizeSupporting(
      {
        text: 'He sailed west.',
        grammarSpotlight: [
          {
            skillId: 'grammar.past-simple.irregular',
            structure: 'past',
            examplesFromText: ['He sailed west.', 'Frase removida.'],
            explanationPtBr: '...',
          },
          {
            skillId: 'grammar.invented',
            structure: 'x',
            examplesFromText: [],
            explanationPtBr: '...',
          },
        ],
        registerNotes: [
          {
            registerNoteId: 'register.invented',
            spoken: 'a',
            standard: 'b',
            notePtBr: 'c',
          },
        ],
        vocabulary: [
          { term: 'sail', meaningPtBr: 'navegar', example: 'x', cefr: 'A2' },
          { term: 'Sail ', meaningPtBr: 'navegar', example: 'x', cefr: 'A2' },
        ],
      },
      allowed,
    );

    expect(cleaned.grammarSpotlight).toHaveLength(1);
    expect(cleaned.grammarSpotlight[0]?.examplesFromText).toEqual([
      'He sailed west.',
    ]);
    expect(cleaned.registerNotes[0]?.registerNoteId).toBeNull();
    expect(cleaned.vocabulary).toHaveLength(1);
  });
});

describe('exercícios', () => {
  const refs: ExerciseRefs = {
    skillIds: new Set(['grammar.past-simple.irregular', 'reading.short-texts']),
    errorPatternIds: new Set(['past-simple.base-form']),
    registerNoteIds: new Set(['gonna']),
  };
  const draft = (
    overrides: Partial<GeneratedExerciseDraft>,
  ): GeneratedExerciseDraft => ({
    purpose: 'TARGET_STRUCTURE',
    type: 'FILL_BLANK',
    prompt: 'Complete.',
    options: null,
    correctOptionIds: null,
    sentence: 'He ___ west.',
    hint: null,
    tokens: null,
    sourceText: null,
    registerNoteId: null,
    direction: null,
    acceptedAnswers: ['sailed'],
    explanation: 'O certo é "sailed".',
    errorPatterns: [
      { wrongAnswer: 'sail', errorPatternId: 'past-simple.base-form' },
      { wrongAnswer: 'sails', errorPatternId: 'invented' },
    ],
    skillIds: ['grammar.past-simple.irregular', 'grammar.invented'],
    ...overrides,
  });

  it('aceita o que se autocorrige e limpa ids desconhecidos', () => {
    const verdict = validateExercise(draft({}), refs);

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.exercise.skillIds).toEqual([
        'grammar.past-simple.irregular',
      ]);
      expect(verdict.exercise.errorPatternMap).toEqual({
        sail: 'past-simple.base-form',
      });
    }
  });

  it('recusa gabarito que o próprio corretor não aceita', () => {
    // Múltipla escolha apontando para alternativa inexistente.
    expect(
      validateExercise(
        draft({
          type: 'MULTIPLE_CHOICE',
          sentence: null,
          acceptedAnswers: [],
          options: [
            { id: 'a', text: 'went' },
            { id: 'b', text: 'go' },
          ],
          correctOptionIds: ['c'],
        }),
        refs,
      ).ok,
    ).toBe(false);

    // Peças que não formam a resposta.
    expect(
      validateExercise(
        draft({
          type: 'ORDER_WORDS',
          sentence: null,
          tokens: ['He', 'sailed'],
          acceptedAnswers: ['He sailed west'],
        }),
        refs,
      ).ok,
    ).toBe(false);
  });

  it('ORDER_WORDS: peças embaralhadas e gabarito que monta a frase', () => {
    const verdict = validateExercise(
      draft({
        type: 'ORDER_WORDS',
        sentence: null,
        tokens: ['He', 'sailed', 'west'],
        acceptedAnswers: ['He sailed west'],
      }),
      refs,
    );

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.exercise.content['tokens']).toEqual(
        ['He', 'sailed', 'west'].sort((a, b) => a.localeCompare(b)),
      );
      expect(
        answerKeyResponse({
          type: 'ORDER_WORDS',
          content: verdict.exercise.content,
          acceptedAnswers: verdict.exercise.acceptedAnswers,
        }),
      ).toEqual({ tokens: ['He', 'sailed', 'west'] });
    }
  });

  it('REGISTER_SWAP exige nota de registro dada; sem skill conhecida cai', () => {
    expect(
      validateExercise(
        draft({
          purpose: 'REGISTER',
          type: 'REGISTER_SWAP',
          sentence: null,
          sourceText: "I'm gonna go.",
          direction: 'SPOKEN_TO_STANDARD',
          registerNoteId: 'wanna',
          acceptedAnswers: ["I'm going to go."],
        }),
        refs,
      ).ok,
    ).toBe(false);

    expect(
      validateExercise(draft({ skillIds: ['grammar.invented'] }), refs).ok,
    ).toBe(false);
  });

  it('o conjunto precisa de compreensão e estrutura-alvo', () => {
    const exercise = (purpose: ValidExercise['purpose']): ValidExercise => ({
      purpose,
      type: 'FILL_BLANK',
      prompt: 'x',
      content: {},
      acceptedAnswers: ['x'],
      explanation: 'x',
      errorPatternMap: {},
      skillIds: ['grammar.past-simple.irregular'],
    });
    const targets = new Set(['grammar.past-simple.irregular']);

    expect(
      exerciseMixIssues(
        [
          exercise('COMPREHENSION'),
          exercise('TARGET_STRUCTURE'),
          exercise('VOCABULARY'),
          exercise('REGISTER'),
        ],
        targets,
      ),
    ).toEqual([]);
    expect(
      exerciseMixIssues(
        [exercise('VOCABULARY'), exercise('VOCABULARY')],
        targets,
      ),
    ).toHaveLength(3);
  });
});

describe('conteúdo do aluno', () => {
  it('classifica links: artigo, rede social, recusado', () => {
    expect(classifyUrl('https://news.example.com/a').kind).toBe('ARTICLE');
    expect(classifyUrl('https://www.youtube.com/watch?v=x')).toMatchObject({
      kind: 'SOCIAL',
      platform: 'YOUTUBE',
    });
    expect(classifyUrl('https://youtu.be/x').kind).toBe('SOCIAL');
    expect(classifyUrl('https://m.facebook.com/post/1').kind).toBe('SOCIAL');
    expect(classifyUrl('ftp://example.com/a').kind).toBe('INVALID');
    expect(classifyUrl('http://localhost/admin').kind).toBe('INVALID');
    expect(classifyUrl('http://127.0.0.1/').kind).toBe('INVALID');
    expect(classifyUrl('http://169.254.169.254/latest').kind).toBe('INVALID');
    expect(classifyUrl('http://[::1]/').kind).toBe('INVALID');
    expect(classifyUrl('https://user:pw@example.com/').kind).toBe('INVALID');
    expect(classifyUrl('https://example.com:8080/').kind).toBe('INVALID');
    expect(classifyUrl('não é link').kind).toBe('INVALID');
  });

  it('reconhece endereço interno em IPv4, IPv6 e IPv4 dentro de IPv6', () => {
    for (const address of [
      '10.1.2.3',
      '172.20.0.1',
      '192.168.0.10',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(address)).toBe(true);
    }

    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });

  it('recusa host cujo DNS aponta para rede interna', async () => {
    await expect(
      resolvePublicAddresses('evil.example.com', () =>
        Promise.resolve([
          { address: '93.184.216.34', family: 4 },
          { address: '10.0.0.5', family: 4 },
        ]),
      ),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNAVAILABLE' });

    await expect(
      resolvePublicAddresses('ok.example.com', () =>
        Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
      ),
    ).resolves.toHaveLength(1);
  });

  it('extrai o miolo de uma página, sem o menu', async () => {
    const html = `<html><head><title>Whales</title></head><body>
      <nav>Home | Sports | Weather</nav>
      <article><h1>Whales return</h1><p>${'Whales came back to the bay this winter. '.repeat(20)}</p></article>
      <footer>Copyright</footer></body></html>`;

    const article = await extractArticle(html, 'https://news.example.com/a');

    expect(article.title).toBe('Whales');
    expect(article.text).toContain('Whales came back to the bay');
    expect(article.text).not.toContain('Weather');
  });

  it('distingue inglês de português pelas palavras gramaticais', () => {
    const english =
      'The whales came back to the bay this winter and they stayed there.';
    const portuguese =
      'Eu gosto muito de história, principalmente das guerras e das navegações.';

    expect(looksEnglish(english)).toBe(true);
    expect(looksEnglish(portuguese)).toBe(false);
    expect(englishSignal('')).toBe(0);
  });

  it('estima o nível pelo vocabulário e pelo tamanho da frase', () => {
    expect(estimateLevel('I am Ana. I am from Brazil.')).toBe('A1');
    const long =
      'The committee, which had been meeting for several weeks without reaching any agreement on the budget, finally decided that the proposal should be sent back to the regional offices for another round of consultation.';
    expect(['B2', 'C1']).toContain(estimateLevel(long));
  });

  it('mede cópia literal em palavras e corta a letra copiada demais', () => {
    const lyrics = [
      'I walk along the empty road tonight',
      'and every little light in this old town reminds me of the summer we had together',
    ].join('\n');

    expect(
      longestVerbatimRun(
        'He says every little light in this old town reminds me of home',
        lyrics,
      ),
    ).toBe(10);

    const sentences = [
      { text: 'The song is about a road.' },
      {
        text: 'and every little light in this old town reminds me of the summer we had together',
      },
    ];
    expect(overCopiedSentences(sentences, lyrics)).toEqual([sentences[1]]);
  });
});

describe('nível do material', () => {
  it('sobe e desce sem sair de A1–C1', () => {
    expect(shiftLevel('A1', -1)).toBe('A1');
    expect(shiftLevel('C1', 1)).toBe('C1');
    expect(shiftLevel('A2', 1)).toBe('B1');
  });

  it('confere o tamanho com folga; no conteúdo do aluno só o teto', () => {
    const a2 = LEVEL_PROFILES.A2;
    expect(wordCountIssue(150, a2, { enforceMinimum: true })).toBeNull();
    expect(wordCountIssue(60, a2, { enforceMinimum: true })).toBe('TOO_SHORT');
    expect(wordCountIssue(60, a2, { enforceMinimum: false })).toBeNull();
    expect(wordCountIssue(300, a2, { enforceMinimum: false })).toBe('TOO_LONG');
    expect(countWords('I am — Ana, 22.')).toBe(4);
  });

  it('calibração: só sinal repetido move um degrau', () => {
    expect(levelBias(['TOO_HARD'])).toBe(0);
    expect(levelBias(['TOO_HARD', 'OK', 'TOO_HARD'])).toBe(-1);
    expect(levelBias(['TOO_EASY', 'TOO_EASY', null])).toBe(1);
    expect(levelBias(['TOO_EASY', 'TOO_HARD', 'TOO_EASY'])).toBe(0);
    // Só as 5 mais recentes contam.
    expect(
      levelBias(['OK', 'OK', 'OK', 'OK', 'OK', 'TOO_HARD', 'TOO_HARD']),
    ).toBe(0);
    expect(materialLevel('A2', -1)).toBe('A1');
  });

  it('nota vira sinal de interesse nas pontas', () => {
    expect(ratingSignal(5)).toBe('MATERIAL_RATED_HIGH');
    expect(ratingSignal(3)).toBeNull();
    expect(ratingSignal(1)).toBe('MATERIAL_RATED_LOW');
  });
});

describe('etapas do pedido', () => {
  it('cada tipo tem sua sequência', () => {
    expect(stepsFor('SUGGEST')).toEqual(['SUGGEST']);
    expect(stepsFor('TOPIC')[0]).toBe('FETCH_SOURCE');
    expect(stepsFor('TOPIC', { surprise: true })[0]).toBe('SUGGEST');
    expect(stepsFor('INGEST').slice(0, 2)).toEqual([
      'INGEST_SOURCE',
      'ANALYZE',
    ]);
  });

  it('marca, reconhece o que terminou e falha a que estava rodando', () => {
    const at = new Date('2026-09-25T12:00:00Z');
    let steps = initialSteps(stepsFor('TOPIC'));
    steps = markStep(steps, 'FETCH_SOURCE', 'RUNNING', at);
    steps = markStep(steps, 'FETCH_SOURCE', 'DONE', at);
    steps = markStep(steps, 'PICK_TARGETS', 'RUNNING', at);

    expect(isDone(steps, 'FETCH_SOURCE')).toBe(true);
    expect(isDone(steps, 'PICK_TARGETS')).toBe(false);
    expect(steps[0]?.startedAt).toBe(at.toISOString());

    const failed = failRunning(steps, at);
    expect(failed.find((s) => s.step === 'PICK_TARGETS')?.status).toBe(
      'FAILED',
    );
  });
});
