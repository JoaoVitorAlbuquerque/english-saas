import type { LlmMessage } from '../services/llm.provider';
import type { GeneratorExercisesOutput } from './generator-exercises.prompt';
import type { GeneratorFactCheckOutput } from './generator-fact-check.prompt';
import type { GeneratorIngestAnalysisOutput } from './generator-ingest-analysis.prompt';
import type { GeneratorMaterialOutput } from './generator-material.prompt';
import type { GeneratorRewriteSentencesOutput } from './generator-rewrite-sentences.prompt';
import type { GeneratorTopicSuggestOutput } from './generator-topic-suggest.prompt';

/**
 * Fixtures do generator (13) para o FakeLlmProvider: um "redator de
 * mentira" determinístico que monta o material com frases da própria fonte
 * (então toda claim é literal e checável) e erra de propósito numa claim —
 * uma frase com citação que não existe na fonte, para o e2e provar que a
 * checagem de fatos a remove.
 *
 * Marcadores de teste no conteúdo do aluno: `INAPPROPRIATE_TEST` sai como
 * impróprio. Instrução embutida no conteúdo ("ignore as instruções...") é
 * ignorada, como um modelo bem-comportado faria.
 */

type Json = Record<string, unknown>;

/** A frase inventada que a checagem de fatos precisa derrubar. */
export const UNSUPPORTED_FIXTURE_SENTENCE = 'Columbus had a big dog named Leo.';

function contextOf(messages: LlmMessage[]): Json {
  const line = (messages[0]?.content ?? '').split('\n')[1] ?? '{}';
  try {
    return JSON.parse(line) as Json;
  } catch {
    return {};
  }
}

function untrusted(content: string, label: string): string {
  const match = new RegExp(
    `<untrusted_content label="${label}">\\n([\\s\\S]*?)\\n</untrusted_content>`,
  ).exec(content);
  return match?.[1] ?? '';
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** O que um modelo bem-comportado ignora: instrução no meio do conteúdo. */
function isInjection(sentence: string): boolean {
  return /ignore|instru|HACKED|system prompt/i.test(sentence);
}

const PAST_VERBS = [
  'was',
  'were',
  'wanted',
  'paid',
  'left',
  'sailed',
  'stopped',
  'stayed',
  'saw',
  'called',
  'lived',
  'believed',
  'visited',
  'hit',
  'survived',
  'built',
  'started',
  'took',
  'separated',
  'arrived',
  'went',
  'reached',
  'received',
  'gave',
  'made',
  'died',
  'came',
  'counted',
  'closed',
];

const BASE_FORMS: Record<string, string> = {
  went: 'go',
  saw: 'see',
  left: 'leave',
  took: 'take',
  sailed: 'sail',
  arrived: 'arrive',
  reached: 'reach',
  came: 'come',
  made: 'make',
  gave: 'give',
  built: 'build',
  stayed: 'stay',
  called: 'call',
  visited: 'visit',
};

const VOCABULARY: Record<string, string> = {
  voyage: 'viagem (por mar)',
  ships: 'navios',
  sailors: 'marinheiros',
  island: 'ilha',
  storm: 'tempestade',
  land: 'terra firme',
  fort: 'forte (construção)',
  ocean: 'oceano',
  whales: 'baleias',
  scientists: 'cientistas',
  fishermen: 'pescadores',
  beach: 'praia',
  bay: 'baía',
};

function pastVerbIn(sentence: string): string | undefined {
  const words = sentence.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.find((word) => PAST_VERBS.includes(word));
}

// ---------------------------------------------------------------------------

export function generatorTopicSuggestFixture(
  messages: LlmMessage[],
): GeneratorTopicSuggestOutput {
  const text = untrusted(messages[0]?.content ?? '', 'interest_text');

  if (text.includes('INAPPROPRIATE_TEST')) {
    return { safety: 'INAPPROPRIATE', themes: [], suggestions: [] };
  }

  const themes = [
    ...(/hist/i.test(text) || text.trim() === '' ? ['história'] : []),
    ...(/naveg/i.test(text) ? ['navegações'] : []),
    ...(/guerr/i.test(text) ? ['guerras'] : []),
  ];

  return {
    safety: 'OK',
    themes: themes.length === 0 ? ['curiosidades'] : themes,
    suggestions: [
      {
        title: 'The first voyage of Christopher Columbus (1492)',
        whyInteresting:
          'Três navios pequenos atravessaram um oceano que ninguém da Europa conhecia.',
        wikipediaSearchQuery: 'Voyages of Christopher Columbus',
        category: 'HISTORY',
      },
      {
        title: 'Magellan and the first trip around the world',
        whyInteresting:
          'A primeira volta ao mundo levou três anos, e poucos marinheiros voltaram.',
        wikipediaSearchQuery: 'Magellan expedition',
        category: 'HISTORY',
      },
      {
        title: 'Gutenberg and the printing press',
        whyInteresting: 'Uma máquina que mudou quem podia ler e aprender.',
        wikipediaSearchQuery: 'Printing press Gutenberg',
        category: 'TECHNOLOGY',
      },
    ],
  };
}

export function generatorMaterialFixture(
  messages: LlmMessage[],
): GeneratorMaterialOutput {
  const content = messages[0]?.content ?? '';
  const context = contextOf(messages);
  const source = untrusted(content, 'source');
  const mode = context['mode'] as 'TOPIC' | 'INGEST';
  const genre = context['genre'] as string | null;
  const profile = (context['profile'] ?? {}) as {
    minWords?: number;
    maxWords?: number;
    maxSentenceWords?: number;
  };
  const targets = (context['targetSkills'] ?? []) as {
    id: string;
    title: string;
  }[];
  const notes = (context['registerNotes'] ?? []) as {
    id: string;
    spokenForm: string;
    standardForm: string;
  }[];

  if (source.includes('INAPPROPRIATE_TEST')) {
    return {
      safety: 'INAPPROPRIATE',
      title: '-',
      text: '-',
      spans: [],
      claims: [],
      grammarSpotlight: [],
      spokenVersion: {
        setup: '-',
        lines: [
          { speaker: 'A', spoken: '-', standard: null },
          { speaker: 'B', spoken: '-', standard: null },
        ],
      },
      registerNotes: [],
      vocabulary: [],
    };
  }

  const available = sentencesOf(source).filter(
    (sentence) =>
      !isInjection(sentence) &&
      wordCount(sentence) <= (profile.maxSentenceWords ?? 14),
  );
  const minWords = profile.minWords ?? 120;
  const maxWords = profile.maxWords ?? 180;
  const picked: string[] = [];
  let total = 0;

  if (genre === 'LYRICS') {
    // Paráfrase sem dado checável + uma linha longa copiada da letra, que
    // o corte de cópia literal precisa derrubar.
    picked.push(
      'This song is about a person who misses someone.',
      'The singer talks about the summer and a long road.',
      'The words are simple and they repeat a lot.',
    );
    const longest = [...sourceLines(source)].sort(
      (a, b) => wordCount(b) - wordCount(a),
    )[0];
    if (longest !== undefined) picked.push(longest);
  } else {
    for (const sentence of available) {
      if (total >= minWords) break;
      if (total + wordCount(sentence) > maxWords) break;
      picked.push(sentence);
      total += wordCount(sentence);
    }
  }

  const claims = picked
    .filter((sentence) => /\d|\s[A-Z]/.test(sentence))
    .map((sentence) => ({ sentence, sourceQuote: sentence }));

  if (mode === 'TOPIC') {
    picked.splice(2, 0, UNSUPPORTED_FIXTURE_SENTENCE);
    claims.push({
      sentence: UNSUPPORTED_FIXTURE_SENTENCE,
      sourceQuote: 'Columbus traveled with his dog Leo.',
    });
  }

  const text = picked.join(' ');
  const pastSentences = picked.filter((sentence) => pastVerbIn(sentence));
  const grammarTarget = targets[0];
  const spans: GeneratorMaterialOutput['spans'] = [];

  if (grammarTarget !== undefined) {
    for (const sentence of pastSentences.slice(0, 4)) {
      const verb = pastVerbIn(sentence);
      if (verb === undefined) continue;
      if (spans.some((span) => span.text === verb)) continue;
      spans.push({
        text: verb,
        occurrence: 1,
        kind: 'GRAMMAR',
        skillId: grammarTarget.id,
        registerNoteId: null,
        explanationPtBr: `"${verb}" está no passado.`,
      });
    }
  }

  // Um destaque com skill que a IA não recebeu: o serviço tem de descartar.
  spans.push({
    text: picked[0]?.split(' ')[0] ?? 'The',
    occurrence: 1,
    kind: 'GRAMMAR',
    skillId: 'grammar.invented-by-ai',
    registerNoteId: null,
    explanationPtBr: 'Destaque inventado.',
  });

  const vocabulary = Object.entries(VOCABULARY)
    .filter(([term]) => new RegExp(`\\b${term}\\b`, 'i').test(text))
    .slice(0, 8)
    .map(([term, meaningPtBr]) => ({
      term,
      meaningPtBr,
      example:
        picked.find((sentence) =>
          new RegExp(`\\b${term}\\b`, 'i').test(sentence),
        ) ?? text.slice(0, 80),
      cefr: 'A2' as const,
    }));

  const title =
    mode === 'TOPIC'
      ? String(context['sourceTitle'] ?? 'A real story')
      : String(context['sourceTitle'] ?? 'Your text');

  return {
    safety: 'OK',
    title,
    text,
    spans,
    claims,
    grammarSpotlight: targets.map((target) => ({
      skillId: target.id,
      structure: target.title,
      examplesFromText: pastSentences.slice(0, 2),
      explanationPtBr: `No texto, ${target.title.toLowerCase()} aparece assim.`,
    })),
    spokenVersion: {
      setup: 'Duas amigas conversando sobre o texto no intervalo.',
      lines: [
        {
          speaker: 'Ana',
          spoken: 'You read this story?',
          standard: 'Did you read this story?',
        },
        {
          speaker: 'Bia',
          spoken: "Yeah, I'm gonna read it again tonight.",
          standard: 'Yes, I am going to read it again tonight.',
        },
        {
          speaker: 'Ana',
          spoken: 'Wanna read it together?',
          standard: 'Do you want to read it together?',
        },
        { speaker: 'Bia', spoken: 'Sure!', standard: null },
      ],
    },
    registerNotes: [
      ...notes.map((note) => ({
        registerNoteId: note.id,
        spoken: note.spokenForm,
        standard: note.standardForm,
        notePtBr: `Na fala, "${note.standardForm}" costuma virar "${note.spokenForm}".`,
      })),
      {
        registerNoteId: 'register.invented-by-ai',
        spoken: 'You read this?',
        standard: 'Did you read this?',
        notePtBr: 'Na fala, o "did" da pergunta às vezes some.',
      },
    ],
    vocabulary:
      vocabulary.length > 0
        ? vocabulary
        : [
            {
              term: 'story',
              meaningPtBr: 'história',
              example: 'This is a short story.',
              cefr: 'A1',
            },
          ],
  };
}

function sourceLines(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isInjection(line));
}

export function generatorFactCheckFixture(
  messages: LlmMessage[],
): GeneratorFactCheckOutput {
  const raw = untrusted(messages[0]?.content ?? '', 'claims');
  let claims: { index: number; sentence: string; sourceQuote: string }[] = [];

  try {
    claims = JSON.parse(raw) as typeof claims;
  } catch {
    claims = [];
  }

  // Sustentada se todo número da frase está na citação.
  return {
    verdicts: claims.map((claim) => {
      const numbers = claim.sentence.match(/\d+/g) ?? [];
      const supported = numbers.every((n) => claim.sourceQuote.includes(n));
      return {
        index: claim.index,
        supported,
        reason: supported
          ? 'Confere com a citação.'
          : 'Número fora da citação.',
      };
    }),
  };
}

export function generatorRewriteSentencesFixture(
  messages: LlmMessage[],
): GeneratorRewriteSentencesOutput {
  const context = contextOf(messages);
  const sentences = (context['sentences'] ?? []) as { index: number }[];

  // O redator de mentira não sabe consertar: a frase sai do texto.
  return {
    rewrites: sentences.map((sentence) => ({
      index: sentence.index,
      sentence: null,
      sourceQuote: null,
    })),
  };
}

export function generatorExercisesFixture(
  messages: LlmMessage[],
): GeneratorExercisesOutput {
  const content = messages[0]?.content ?? '';
  const context = contextOf(messages);
  const text = untrusted(content, 'material_text');
  const targets = (context['targetSkills'] ?? []) as { id: string }[];
  const comprehension =
    (context['comprehensionSkillId'] as string | null) ?? targets[0]?.id ?? '';
  const notes = (context['registerNotes'] ?? []) as {
    id: string;
    spokenForm: string;
    standardForm: string;
  }[];
  const vocabulary = (context['vocabulary'] ?? []) as {
    term: string;
    meaningPtBr: string;
  }[];
  const errorIds = new Set(
    ((context['errorPatterns'] ?? []) as { id: string }[]).map((e) => e.id),
  );
  const sentences = sentencesOf(text);
  const first = sentences[0] ?? 'This is a story.';
  const second = sentences[1] ?? first;
  const blank = {
    options: null,
    correctOptionIds: null,
    sentence: null,
    hint: null,
    tokens: null,
    sourceText: null,
    registerNoteId: null,
    direction: null,
    acceptedAnswers: [] as string[],
    errorPatterns: [] as { wrongAnswer: string; errorPatternId: string }[],
  };

  const exercises: GeneratorExercisesOutput['exercises'] = [
    {
      ...blank,
      purpose: 'COMPREHENSION',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Qual destas frases está no texto?',
      options: [
        { id: 'a', text: first },
        { id: 'b', text: 'Nobody wrote about this.' },
        { id: 'c', text: 'It happened last week.' },
      ],
      correctOptionIds: ['a'],
      explanation: `A frase do texto é: "${first}"`,
      skillIds: [comprehension],
    },
    {
      ...blank,
      purpose: 'COMPREHENSION',
      type: 'MULTIPLE_CHOICE',
      prompt: 'E qual destas também está no texto?',
      options: [
        { id: 'a', text: 'Everybody stayed at home.' },
        { id: 'b', text: second },
      ],
      correctOptionIds: ['b'],
      explanation: `A frase do texto é: "${second}"`,
      skillIds: [comprehension],
    },
  ];

  const target = targets[0];
  // Frase com verbo no passado; sem nenhuma (letra de música), a primeira
  // frase com a palavra mais longa dela na lacuna.
  const withVerb =
    sentences.find((sentence) => pastVerbIn(sentence)) ?? sentences[0];
  const verb =
    withVerb === undefined
      ? undefined
      : (pastVerbIn(withVerb) ??
        [...(withVerb.match(/[a-z]{4,}/g) ?? [])].sort(
          (a, b) => b.length - a.length,
        )[0]);

  if (target !== undefined && withVerb !== undefined && verb !== undefined) {
    const base = BASE_FORMS[verb];
    exercises.push({
      ...blank,
      purpose: 'TARGET_STRUCTURE',
      type: 'FILL_BLANK',
      prompt: 'Complete com o verbo no passado.',
      sentence: withVerb.replace(new RegExp(`\\b${verb}\\b`, 'i'), '___'),
      hint: base === undefined ? null : `verbo "${base}"`,
      acceptedAnswers: [verb],
      explanation: `O certo é "${verb}", no passado.`,
      errorPatterns:
        base !== undefined && errorIds.has('past-simple.base-form')
          ? [{ wrongAnswer: base, errorPatternId: 'past-simple.base-form' }]
          : [],
      skillIds: [target.id],
    });
  }

  const short = sentences.find(
    (sentence) => wordCount(sentence) >= 3 && wordCount(sentence) <= 8,
  );

  if (target !== undefined && short !== undefined) {
    const answer = short.replace(/[.!?]+$/, '');
    exercises.push({
      ...blank,
      purpose: 'TARGET_STRUCTURE',
      type: 'ORDER_WORDS',
      prompt: 'Coloque as palavras na ordem certa.',
      tokens: answer.split(/\s+/),
      acceptedAnswers: [answer],
      explanation: `A frase é: "${answer}".`,
      skillIds: [(targets[1] ?? target).id],
    });
  }

  const note = notes[0];
  if (note !== undefined) {
    exercises.push({
      ...blank,
      purpose: 'REGISTER',
      type: 'REGISTER_SWAP',
      prompt: 'Escreva na forma padrão, como num texto formal.',
      sourceText: note.spokenForm,
      registerNoteId: note.id,
      direction: 'SPOKEN_TO_STANDARD',
      acceptedAnswers: [note.standardForm],
      explanation: `Na forma padrão fica "${note.standardForm}".`,
      skillIds: [comprehension],
    });
  }

  const term = vocabulary[0];
  if (term !== undefined) {
    exercises.push({
      ...blank,
      purpose: 'VOCABULARY',
      type: 'TYPE_ANSWER',
      prompt: `Como se diz "${term.meaningPtBr}" em inglês, do jeito que aparece no texto?`,
      sourceText: term.meaningPtBr,
      acceptedAnswers: [term.term],
      explanation: `A palavra é "${term.term}".`,
      skillIds: [comprehension],
    });
  }

  return { exercises };
}

export function generatorIngestAnalysisFixture(
  messages: LlmMessage[],
): GeneratorIngestAnalysisOutput {
  const text = untrusted(messages[0]?.content ?? '', 'student_content');
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const english =
    (text.match(/\b(the|and|was|is|you|in|of|to)\b/gi) ?? []).length /
    Math.max(1, wordCount(text));
  const lyrics =
    lines.length >= 6 &&
    lines.reduce((sum, line) => sum + wordCount(line), 0) / lines.length <= 9;

  return {
    safety: text.includes('INAPPROPRIATE_TEST') ? 'INAPPROPRIATE' : 'OK',
    language: english >= 0.1 ? 'en' : 'pt',
    genre: lyrics
      ? 'LYRICS'
      : /whale|news|reported/i.test(text)
        ? 'NEWS'
        : 'OTHER',
    topic: lyrics ? 'música' : /whale/i.test(text) ? 'natureza' : 'atualidades',
    title: (lines[0] ?? 'Your text').slice(0, 60),
  };
}
