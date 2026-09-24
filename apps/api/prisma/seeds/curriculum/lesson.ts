import type { LessonStepType } from '@prisma/client';

/**
 * A lição "Nice to meet you" — A1, unidade 1, lição 1.
 *
 * Lucas (brasileiro, 24) acabou de se mudar para Austin e conhece a vizinha
 * Maya, do 4B, e o cachorro dela, Biscuit.
 *
 * Os índices das marcações (`spans`) são contados sobre o `text` da fala,
 * em unidades de código UTF-16 — o mesmo que `String#slice` usa. Errar um
 * deles é erro de conteúdo, e o `validateSpans` recusa na hora de gravar.
 */

export type StepSeed = {
  order: number;
  type: LessonStepType;
  content: Record<string, unknown>;
};

export type LessonContext = {
  /** id → uuid, por slug de personagem. */
  characters: Record<string, string>;
  /** id → uuid, por chave de asset. */
  audio: Record<string, string>;
  /** id → uuid, por slug de item. */
  items: Record<string, string>;
};

/** Chaves dos áudios da cena, na ordem das falas. */
export const SCENE_AUDIO_KEYS = [
  'scene-full',
  'scene-line-1',
  'scene-line-2',
  'scene-line-3',
  'scene-line-4',
  'scene-line-5',
  'scene-line-6',
  'scene-line-7',
  'scene-line-8',
] as const;

export function buildLessonSteps(ctx: LessonContext): StepSeed[] {
  const maya = ctx.characters['maya'] ?? '';
  const lucas = ctx.characters['lucas'] ?? '';
  const biscuit = ctx.characters['biscuit'] ?? '';
  const audio = (key: string) => ctx.audio[key] ?? '';
  const item = (slug: string) => ctx.items[slug] ?? '';

  return [
    // -----------------------------------------------------------------
    // 0 — Cena
    // -----------------------------------------------------------------
    {
      order: 0,
      type: 'SCENE',
      content: {
        location: 'Corredor do prédio, em Austin, no Texas',
        summary:
          'Lucas acabou de se mudar. No corredor, ele esbarra na vizinha do 4B e no cachorro dela.',
        characterIds: [maya, lucas, biscuit],
        audioAssetId: audio('scene-full'),
        lines: [
          {
            characterId: maya,
            text: 'Hi! Are you new here?',
            translation: 'Oi! Você é novo aqui?',
            audioAssetId: audio('scene-line-1'),
            spans: [
              {
                start: 4,
                end: 21,
                kind: 'GRAMMAR',
                skillId: 'grammar.be.present.questions',
              },
            ],
          },
          {
            characterId: lucas,
            text: "Yes, I am. I'm Lucas.",
            translation: 'Sou, sim. Eu sou o Lucas.',
            audioAssetId: audio('scene-line-2'),
            spans: [
              {
                start: 0,
                end: 10,
                kind: 'GRAMMAR',
                skillId: 'grammar.be.present.short-answers',
              },
              {
                start: 11,
                end: 14,
                kind: 'REGISTER',
                registerNoteId: 'im-contraction',
              },
            ],
          },
          {
            characterId: maya,
            text: "Nice to meet you, Lucas. I'm Maya. I live in 4B.",
            translation:
              'Prazer em te conhecer, Lucas. Eu sou a Maya. Moro no 4B.',
            audioAssetId: audio('scene-line-3'),
            spans: [
              {
                start: 0,
                end: 16,
                kind: 'CHUNK',
                skillId: 'chunk.nice-to-meet-you',
              },
              {
                start: 25,
                end: 28,
                kind: 'REGISTER',
                registerNoteId: 'im-contraction',
              },
            ],
          },
          {
            characterId: lucas,
            text: "Nice to meet you too. I'm from Brazil.",
            translation: 'Prazer em te conhecer também. Eu sou do Brasil.',
            audioAssetId: audio('scene-line-4'),
            spans: [
              {
                start: 0,
                end: 20,
                kind: 'CHUNK',
                skillId: 'chunk.nice-to-meet-you',
              },
              {
                start: 22,
                end: 30,
                kind: 'CHUNK',
                skillId: 'chunk.where-are-you-from',
              },
            ],
          },
          {
            characterId: maya,
            text: 'Oh, cool! Where in Brazil?',
            translation: 'Ah, legal! Onde no Brasil?',
            audioAssetId: audio('scene-line-5'),
            spans: [],
          },
          {
            characterId: lucas,
            text: "I'm from Campinas. It's near São Paulo.",
            translation: 'Eu sou de Campinas. Fica perto de São Paulo.',
            audioAssetId: audio('scene-line-6'),
            spans: [
              {
                start: 0,
                end: 8,
                kind: 'CHUNK',
                skillId: 'chunk.where-are-you-from',
              },
              {
                start: 19,
                end: 23,
                kind: 'REGISTER',
                registerNoteId: 'be-contraction-third',
              },
            ],
          },
          {
            characterId: maya,
            text: "Welcome to Austin! This is Biscuit. He's very friendly.",
            translation:
              'Bem-vindo a Austin! Este é o Biscuit. Ele é muito amigável.',
            audioAssetId: audio('scene-line-7'),
            spans: [
              {
                start: 19,
                end: 26,
                kind: 'GRAMMAR',
                skillId: 'grammar.be.present.affirmative',
              },
              {
                start: 36,
                end: 40,
                kind: 'REGISTER',
                registerNoteId: 'be-contraction-third',
              },
            ],
          },
          {
            characterId: lucas,
            text: "Hi, Biscuit! He's so cute.",
            translation: 'Oi, Biscuit! Ele é tão fofo.',
            audioAssetId: audio('scene-line-8'),
            spans: [
              {
                start: 13,
                end: 17,
                kind: 'REGISTER',
                registerNoteId: 'be-contraction-third',
              },
            ],
          },
        ],
      },
    },

    // -----------------------------------------------------------------
    // 1 — Cards de explicação
    // -----------------------------------------------------------------
    {
      order: 1,
      type: 'EXPLANATION_CARDS',
      content: {
        cards: [
          {
            title: "I'm = I am",
            bodyMd:
              'Os dois querem dizer a mesma coisa. **Na fala, quase sempre sai a forma curta** — dizer "I am" inteiro soa como quem está insistindo em alguma coisa.',
            examples: [
              {
                text: "I'm Lucas.",
                translation: 'Eu sou o Lucas.',
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
          {
            title: 'O verbo to be muda com a pessoa',
            bodyMd:
              'É o verbo mais usado do inglês e o único que muda tanto. Vale decorar a tabela inteira agora — ela volta em tudo.',
            table: {
              headers: ['Pessoa', 'Forma completa', 'Na fala'],
              rows: [
                ['I', 'I am', "I'm"],
                ['you / we / they', 'you are', "you're"],
                ['he / she / it', 'he is', "he's"],
              ],
            },
            examples: [
              {
                text: 'She is from Austin.',
                translation: 'Ela é de Austin.',
                spans: [
                  {
                    start: 4,
                    end: 6,
                    kind: 'GRAMMAR',
                    skillId: 'grammar.be.present.affirmative',
                  },
                ],
              },
            ],
          },
          {
            title: 'Um lugar onde não encurta',
            bodyMd:
              "Na resposta curta afirmativa, o verbo fica no fim da frase — e aí ele **não** encurta.\n\nCerto: `Yes, I am.`\nErrado: ~~Yes, I'm.~~\n\nNa negativa pode: `No, I'm not.`",
            examples: [
              {
                text: 'Yes, I am.',
                translation: 'Sou, sim.',
                spans: [
                  {
                    start: 0,
                    end: 10,
                    kind: 'GRAMMAR',
                    skillId: 'grammar.be.present.short-answers',
                  },
                ],
              },
            ],
          },
          {
            title: 'Blocos prontos para se apresentar',
            bodyMd:
              "Não monte palavra por palavra. Decore o bloco inteiro e troque só o final.\n\n- `Nice to meet you.` — quando conhece alguém\n- `Nice to meet you too.` — a resposta\n- `Where are you from?` → `I'm from ___.`",
            examples: [
              {
                text: 'Nice to meet you.',
                translation: 'Prazer em te conhecer.',
                spans: [
                  {
                    start: 0,
                    end: 16,
                    kind: 'CHUNK',
                    skillId: 'chunk.nice-to-meet-you',
                  },
                ],
              },
              {
                text: 'Where are you from?',
                translation: 'De onde você é?',
                spans: [
                  {
                    start: 0,
                    end: 18,
                    kind: 'CHUNK',
                    skillId: 'chunk.where-are-you-from',
                  },
                ],
              },
            ],
          },
        ],
      },
    },

    // -----------------------------------------------------------------
    // 2 — Prática
    // -----------------------------------------------------------------
    {
      order: 2,
      type: 'PRACTICE',
      content: {
        itemIds: [
          item('a1-be-i-am-maya'),
          item('a1-listen-hes-friendly'),
          item('a1-order-im-from-brazil'),
          item('a1-fill-biscuit-is-a-dog'),
          item('a1-reply-nice-to-meet-you'),
          item('a1-order-nice-to-meet-you'),
          item('a1-type-shes-from-austin'),
        ],
        shuffle: false,
      },
    },

    // -----------------------------------------------------------------
    // 3 — Produção livre
    // -----------------------------------------------------------------
    {
      order: 3,
      type: 'FREE_PRODUCTION',
      content: {
        prompt:
          'Você é o Lucas e acabou de encontrar a Maya no corredor. Escreva como você se apresentaria: diga seu nome, de onde você é e mais uma informação sobre você.',
        helpers: [
          "I'm ___.",
          'My name is ___.',
          "I'm from ___.",
          "I'm 24 years old.",
          'I live in ___.',
        ],
        rubric: [
          {
            id: 'says-name',
            description: 'Diz o nome com "I\'m ___" ou "My name is ___".',
            skillId: 'chunk.my-name-is',
          },
          {
            id: 'says-origin',
            description: 'Diz de onde é com "I\'m from ___".',
            skillId: 'chunk.where-are-you-from',
          },
          {
            id: 'no-have-for-age',
            description: 'Não usa "I have X years" para falar de idade.',
            skillId: 'grammar.be.present.affirmative',
            errorPatternId: 'l1.have-for-age',
          },
        ],
        targetSkillIds: [
          'function.introduce-yourself',
          'chunk.my-name-is',
          'chunk.where-are-you-from',
        ],
        minWords: 12,
      },
    },

    // -----------------------------------------------------------------
    // 4 — Roleplay
    // -----------------------------------------------------------------
    {
      order: 4,
      type: 'ROLEPLAY',
      content: {
        characterId: maya,
        scenario:
          'Você encontra a Maya no elevador do prédio. Ela puxa conversa. Responda como você mesmo, não como o Lucas.',
        openingLine: 'Hey! Going up? I think I saw you moving in yesterday.',
        goals: [
          {
            id: 'tell-name',
            description: 'Dizer o seu nome.',
            skillIds: ['chunk.my-name-is'],
          },
          {
            id: 'tell-origin',
            description: 'Dizer de onde você é.',
            skillIds: ['chunk.where-are-you-from'],
          },
          {
            id: 'answer-yes-no',
            description:
              'Responder sim ou não quando ela perguntar se é a sua primeira vez em Austin.',
            skillIds: ['grammar.be.present.short-answers'],
          },
        ],
        maxTurns: 10,
        allowedVocabularyLevel: 'A1',
      },
    },

    // -----------------------------------------------------------------
    // 5 — Resumo
    // -----------------------------------------------------------------
    {
      order: 5,
      type: 'SUMMARY',
      content: {
        takeaways: [
          'O verbo to be muda com a pessoa: I am, you are, he/she/it is.',
          "Na fala é quase sempre a forma curta: I'm, you're, he's.",
          'Mas na resposta curta afirmativa não encurta: "Yes, I am".',
          '"Nice to meet you" e "Where are you from?" são blocos prontos — decore inteiros.',
          'País não leva "the": I\'m from Brazil.',
        ],
        skillIds: [
          'grammar.be.present.affirmative',
          'grammar.be.present.questions',
          'grammar.be.present.short-answers',
          'grammar.contractions.be',
          'chunk.nice-to-meet-you',
          'chunk.where-are-you-from',
          'chunk.my-name-is',
          'function.introduce-yourself',
        ],
        registerNoteIds: ['im-contraction', 'be-contraction-third'],
      },
    },
  ];
}
