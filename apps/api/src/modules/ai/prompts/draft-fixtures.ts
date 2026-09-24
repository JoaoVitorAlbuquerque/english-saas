import type { LlmMessage } from '../services/llm.provider';

/**
 * Fixtures dos prompts de autoria.
 *
 * Elas **leem a mensagem do turno** em vez de devolver um valor fixo: o
 * teste cria skills e personagens com ids próprios, e uma lição fixa
 * apontando para slug inventado não passaria na validação de referências do
 * módulo 4. Assim a mesma fixture serve para qualquer cenário de teste.
 */

function userContent(messages: LlmMessage[]): string {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
}

/** `- maya — Maya: bio` → `maya` */
function extractCharacterSlugs(content: string): string[] {
  return [...content.matchAll(/^- ([a-z0-9-]+) — /gm)].map(
    (match) => match[1] ?? '',
  );
}

/** `- grammar.be.present [GRAMMAR] Título` → `grammar.be.present` */
function extractSkillIds(content: string): string[] {
  return [...content.matchAll(/^- ([a-z0-9.-]+) \[/gm)].map(
    (match) => match[1] ?? '',
  );
}

/**
 * `SKILL: grammar.be.present [GRAMMAR] Título`
 *
 * O prompt de questões avulsas passa uma skill só, e sem o hífen da lista —
 * por isso não dá para reusar o extrator da lição.
 */
function extractSingleSkillId(content: string): string[] {
  const match = /^SKILL: ([a-z0-9.-]+) \[/m.exec(content);

  return match === null ? [] : [match[1] ?? ''];
}

/** `- l1.have-for-age: "..." → "..."` (erro típico traz a seta) */
function extractErrorPatternIds(content: string): string[] {
  return [...content.matchAll(/^- ([a-z0-9.-]+): ".*" → /gm)].map(
    (match) => match[1] ?? '',
  );
}

/** `- gonna: "gonna" = "going to"` (nota de registro traz o igual) */
function extractRegisterNoteIds(content: string): string[] {
  return [...content.matchAll(/^- ([a-z0-9.-]+): ".*" = /gm)].map(
    (match) => match[1] ?? '',
  );
}

type SpanSeed = {
  text: string;
  occurrence: number | null;
  kind: 'CHUNK' | 'GRAMMAR' | 'REGISTER' | 'VOCAB';
  skillId: string | null;
  registerNoteId: string | null;
};

function grammarSpan(text: string, skillId: string | undefined): SpanSeed[] {
  if (skillId === undefined) {
    return [];
  }

  return [
    { text, occurrence: 1, kind: 'GRAMMAR', skillId, registerNoteId: null },
  ];
}

function chunkSpan(text: string, skillId: string | undefined): SpanSeed[] {
  if (skillId === undefined) {
    return [];
  }

  return [
    { text, occurrence: 1, kind: 'CHUNK', skillId, registerNoteId: null },
  ];
}

function registerSpan(text: string, noteId: string | undefined): SpanSeed[] {
  if (noteId === undefined) {
    return [];
  }

  return [
    {
      text,
      occurrence: 1,
      kind: 'REGISTER',
      skillId: null,
      registerNoteId: noteId,
    },
  ];
}

const EMPTY_ITEM = {
  options: null,
  correctOptionIds: null,
  sentence: null,
  hint: null,
  tokens: null,
  sourceText: null,
  audioText: null,
  registerNoteId: null,
  direction: null,
};

function buildItems(skillIds: string[], errorPatternIds: string[]) {
  const skills = skillIds.length > 0 ? skillIds : ['grammar.unknown'];
  const firstError = errorPatternIds[0];
  const errorPatterns =
    firstError === undefined
      ? []
      : [{ wrongAnswer: 'I have 20 years', errorPatternId: firstError }];

  return [
    {
      ...EMPTY_ITEM,
      type: 'MULTIPLE_CHOICE' as const,
      prompt: 'Complete: I ___ Maya.',
      options: [
        { id: 'am', text: 'am' },
        { id: 'is', text: 'is' },
        { id: 'are', text: 'are' },
      ],
      correctOptionIds: ['am'],
      acceptedAnswers: [],
      explanation: 'Com "I", o verbo to be é sempre "am".',
      errorPatterns,
      skillIds: skills.slice(0, 5),
    },
    {
      ...EMPTY_ITEM,
      type: 'FILL_BLANK' as const,
      prompt: 'Complete com o verbo to be.',
      sentence: 'Biscuit ___ a dog.',
      hint: 'Terceira pessoa do singular.',
      acceptedAnswers: ['is'],
      explanation: 'Com "he", "she" e "it" a forma é "is".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'ORDER_WORDS' as const,
      prompt: 'Monte a frase: diga de onde você é.',
      tokens: ['from', "I'm", 'Brazil'],
      acceptedAnswers: ["I'm from Brazil"],
      explanation: 'A ordem é sujeito, verbo e origem: "I\'m from Brazil".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'TYPE_ANSWER' as const,
      prompt: 'Escreva em inglês: "Ela é de Austin."',
      sourceText: 'Ela é de Austin.',
      acceptedAnswers: ["She's from Austin"],
      explanation: '"Ela é" vira "She is", e na fala "She\'s".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'MULTIPLE_CHOICE' as const,
      prompt: 'Alguém diz "Nice to meet you!". O que você responde?',
      options: [
        { id: 'too', text: 'Nice to meet you too.' },
        { id: 'thanks', text: 'Thank you very much.' },
      ],
      correctOptionIds: ['too'],
      acceptedAnswers: [],
      explanation: 'A resposta pronta é "Nice to meet you too".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'LISTEN_CHOOSE' as const,
      prompt: 'Ouça e escolha o que você ouviu.',
      audioText: "He's very friendly.",
      options: [
        { id: 'short', text: "He's very friendly." },
        { id: 'full', text: 'He is very friendly.' },
      ],
      correctOptionIds: ['short'],
      acceptedAnswers: [],
      explanation: 'Na fala, "he is" vira "he\'s".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'DICTATION' as const,
      prompt: 'Ouça e escreva o que você ouviu.',
      audioText: "I'm from Brazil.",
      acceptedAnswers: ["I'm from Brazil."],
      explanation: 'A forma curta "I\'m" é o que se ouve na fala normal.',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
    {
      ...EMPTY_ITEM,
      type: 'ORDER_WORDS' as const,
      prompt: 'Monte a frase de quando você conhece alguém.',
      tokens: ['meet', 'Nice', 'you', 'to'],
      acceptedAnswers: ['Nice to meet you'],
      explanation: 'É um bloco pronto: "Nice to meet you".',
      errorPatterns: [],
      skillIds: skills.slice(0, 1),
    },
  ];
}

/** Lição completa, montada com os slugs que vieram no pedido. */
export function draftLessonFixture(messages: LlmMessage[]): unknown {
  const content = userContent(messages);
  const characters = extractCharacterSlugs(content);
  const skills = extractSkillIds(content);
  const errorPatterns = extractErrorPatternIds(content);
  const registerNotes = extractRegisterNoteIds(content);

  const a = characters[0] ?? 'unknown';
  const b = characters[1] ?? a;

  return {
    title: 'Nice to meet you',
    objective: 'Se apresentar e responder a apresentações.',
    estimatedMinutes: 15,

    scene: {
      location: 'Corredor do prédio, em Austin',
      summary: 'Dois vizinhos se conhecem no corredor.',
      lines: [
        {
          characterSlug: a,
          text: 'Hi! Are you new here?',
          standardText: null,
          translation: 'Oi! Você é novo aqui?',
          spans: grammarSpan('Are you new here?', skills[0]),
        },
        {
          characterSlug: b,
          text: "Yes, I am. I'm Lucas.",
          standardText: null,
          translation: 'Sou, sim. Eu sou o Lucas.',
          spans: registerSpan("I'm", registerNotes[0]),
        },
        {
          characterSlug: a,
          text: 'Nice to meet you, Lucas.',
          standardText: null,
          translation: 'Prazer em te conhecer, Lucas.',
          spans: chunkSpan('Nice to meet you', skills[1] ?? skills[0]),
        },
        {
          characterSlug: b,
          text: "Nice to meet you too. I'm from Brazil.",
          standardText: 'Nice to meet you too. I am from Brazil.',
          translation: 'Prazer em te conhecer também. Eu sou do Brasil.',
          spans: [],
        },
      ],
    },

    cards: [
      {
        title: "I'm = I am",
        bodyMd:
          'Os dois querem dizer a mesma coisa. **Na fala, quase sempre sai a forma curta.**',
        table: {
          headers: ['Pessoa', 'Forma completa', 'Na fala'],
          rows: [
            ['I', 'I am', "I'm"],
            ['he / she / it', 'he is', "he's"],
          ],
        },
        examples: [
          {
            text: "I'm Lucas.",
            translation: 'Eu sou o Lucas.',
            spans: registerSpan("I'm", registerNotes[0]),
          },
        ],
      },
      {
        title: 'Blocos prontos',
        bodyMd:
          'Decore o bloco inteiro e troque só o final: `Nice to meet you.`',
        table: null,
        examples: [
          {
            text: 'Nice to meet you.',
            translation: 'Prazer em te conhecer.',
            spans: chunkSpan('Nice to meet you', skills[1] ?? skills[0]),
          },
        ],
      },
    ],

    practice: buildItems(skills, errorPatterns),

    freeProduction: {
      prompt:
        'Você encontra a vizinha no corredor. Escreva como você se apresentaria: nome, de onde você é e mais uma informação.',
      helpers: ["I'm ___.", "I'm from ___.", 'My name is ___.'],
      rubric: [
        {
          id: 'says-name',
          description: 'Diz o nome com "I\'m ___" ou "My name is ___".',
          skillId: skills[0] ?? null,
          errorPatternId: null,
        },
        {
          id: 'says-origin',
          description: 'Diz de onde é com "I\'m from ___".',
          skillId: skills[0] ?? null,
          errorPatternId: null,
        },
      ],
      minWords: 12,
    },

    roleplay: {
      characterSlug: a,
      scenario: 'Você encontra a vizinha no elevador e ela puxa conversa.',
      openingLine: 'Hey! Going up?',
      goals: [
        {
          id: 'tell-name',
          description: 'Dizer o seu nome.',
          skillIds: skills.slice(0, 1),
        },
        {
          id: 'tell-origin',
          description: 'Dizer de onde você é.',
          skillIds: skills.slice(0, 1),
        },
      ],
      maxTurns: 10,
    },

    summary: {
      takeaways: [
        'O verbo to be muda com a pessoa: I am, you are, he is.',
        'Na fala é quase sempre a forma curta.',
        '"Nice to meet you" é um bloco pronto — decore inteiro.',
      ],
    },
  };
}

/** Questões avulsas, na quantidade pedida. */
export function draftItemsFixture(messages: LlmMessage[]): unknown {
  const content = userContent(messages);
  const skills = extractSingleSkillId(content);
  const errorPatterns = extractErrorPatternIds(content);
  const requested = /Write (\d+) /.exec(content);
  const count = requested === null ? 3 : Number(requested[1]);
  const pool = buildItems(skills, errorPatterns);

  return {
    items: Array.from({ length: Math.min(Math.max(count, 1), 20) }, (_, i) => {
      const base = pool[i % pool.length];

      return { ...base, prompt: `${String(base?.prompt)} (${String(i + 1)})` };
    }),
  };
}

/** Notas de registro, na quantidade pedida e sem repetir o que já existe. */
export function draftRegisterNotesFixture(messages: LlmMessage[]): unknown {
  const content = userContent(messages);
  const requested = /Write (\d+) register notes/.exec(content);
  const count = requested === null ? 2 : Number(requested[1]);

  const pool = [
    {
      id: 'gonna',
      spokenForm: 'gonna',
      standardForm: 'going to',
      register: 'INFORMAL_SPOKEN' as const,
      explanation:
        '"going to" vira "gonna" quando vem antes de um verbo: I\'m gonna call you.',
      whenToAvoid: 'Não escreva "gonna" em e-mail formal.',
      cefrLevel: 'A2' as const,
    },
    {
      id: 'wanna',
      spokenForm: 'wanna',
      standardForm: 'want to',
      register: 'INFORMAL_SPOKEN' as const,
      explanation: '"want to" vira "wanna" na fala: I wanna go home.',
      whenToAvoid: 'Mesma regra do "gonna": só na fala.',
      cefrLevel: 'A2' as const,
    },
    {
      id: 'you-coming',
      spokenForm: 'You coming?',
      standardForm: 'Are you coming?',
      register: 'INFORMAL_SPOKEN' as const,
      explanation: 'Na pergunta informal, o "are" some.',
      whenToAvoid: null,
      cefrLevel: 'A2' as const,
    },
  ];

  const existing = /already exist: (.+)$/m.exec(content);
  const taken = new Set(
    existing === null
      ? []
      : (existing[1] ?? '').split(', ').map((s) => s.trim()),
  );

  const available = pool.filter((note) => !taken.has(note.id));

  return { notes: available.slice(0, Math.max(count, 1)) };
}

/**
 * Revisão linguística.
 *
 * Devolve lista vazia, que é o caso normal — uma revisora que inventa
 * problema para parecer útil é pior que nenhuma. A exceção é a palavra
 * "albeit", que serve de gatilho nos testes para exercitar o caminho do
 * aviso sem depender de modelo de verdade.
 */
export function reviewLanguageFixture(messages: LlmMessage[]): unknown {
  const content = userContent(messages);
  const match = /^\[([^\]]+)\]\nEN: (.*albeit.*)$/m.exec(content);

  if (match === null) {
    return { issues: [] };
  }

  return {
    issues: [
      {
        path: match[1] ?? 'scene',
        kind: 'ENGLISH',
        excerpt: (match[2] ?? '').slice(0, 300),
        message:
          'A palavra "albeit" é formal demais para uma conversa neste nível.',
        suggestion: 'though',
      },
    ],
  };
}
