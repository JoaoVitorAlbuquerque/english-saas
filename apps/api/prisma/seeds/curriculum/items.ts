import type { CefrLevel, ItemType } from '@prisma/client';

/**
 * 20 questões A1 da unidade 1.
 *
 * As sete primeiras são a prática da lição "Nice to meet you", na ordem em
 * que aparecem; as outras treze enchem o banco para o nivelamento (módulo
 * 8) ter de onde sortear, e cobrem os nove tipos de item.
 *
 * `difficulty` fica de fora: sem valor, vem do nível (A1 = -2). A
 * calibração de verdade nasce das tentativas.
 */

export type SeedItem = {
  slug: string;
  type: ItemType;
  prompt: string;
  content: Record<string, unknown>;
  acceptedAnswers?: string[];
  explanation: string;
  errorPatternMap?: Record<string, string>;
  cefrLevel: CefrLevel;
  skillIds: string[];
};

/** As questões da prática da lição, na ordem. */
export const LESSON_ITEM_SLUGS = [
  'a1-be-i-am-maya',
  'a1-listen-hes-friendly',
  'a1-order-im-from-brazil',
  'a1-fill-biscuit-is-a-dog',
  'a1-reply-nice-to-meet-you',
  'a1-order-nice-to-meet-you',
  'a1-type-shes-from-austin',
] as const;

/** Áudios que os itens usam, pela chave do mapa de assets. */
export const ITEM_AUDIO_KEYS = ['item-hes-friendly', 'item-dictation'] as const;

export function buildSeedItems(audio: Record<string, string>): SeedItem[] {
  const hesFriendly = audio['item-hes-friendly'] ?? '';
  const dictation = audio['item-dictation'] ?? '';

  return [
    // --- prática da lição ---
    {
      slug: 'a1-be-i-am-maya',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Complete: I ___ Maya.',
      content: {
        options: [
          { id: 'am', text: 'am' },
          { id: 'is', text: 'is' },
          { id: 'are', text: 'are' },
        ],
        correctOptionIds: ['am'],
        shuffle: true,
      },
      explanation: 'Com "I", o verbo to be é sempre "am".',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.affirmative', 'grammar.subject-pronouns'],
    },
    {
      slug: 'a1-listen-hes-friendly',
      type: 'LISTEN_CHOOSE',
      prompt: 'Ouça e escolha o que a Maya disse.',
      content: {
        audioText: "He's very friendly.",
        audioAssetId: hesFriendly,
        options: [
          { id: 'contracted', text: "He's very friendly." },
          { id: 'full', text: 'He is very friendly.' },
          { id: 'plural', text: 'They are very friendly.' },
        ],
        correctOptionIds: ['contracted'],
        shuffle: true,
      },
      explanation:
        'Na fala, "he is" vira "he\'s" — sobra um "z" colado no "he".',
      cefrLevel: 'A1',
      skillIds: ['register.contracted-be', 'grammar.contractions.be'],
    },
    {
      slug: 'a1-order-im-from-brazil',
      type: 'ORDER_WORDS',
      prompt: 'Monte a frase: diga de onde você é.',
      content: { tokens: ['from', "I'm", 'Brazil'] },
      // "I am from Brazil" não entra: normaliza para a mesma coisa que a
      // forma curta, e o validador recusa gabarito equivalente repetido.
      acceptedAnswers: ["I'm from Brazil"],
      explanation: "A ordem é sujeito + verbo + de onde: I'm from Brazil.",
      errorPatternMap: {
        "I'm from the Brazil": 'article.country-the',
        'From Brazil': 'l1.missing-subject',
      },
      cefrLevel: 'A1',
      skillIds: ['chunk.where-are-you-from', 'grammar.be.present.affirmative'],
    },
    {
      slug: 'a1-fill-biscuit-is-a-dog',
      type: 'FILL_BLANK',
      prompt: 'Complete com o verbo to be.',
      content: {
        sentence: 'Biscuit ___ a dog.',
        hint: 'Biscuit é uma única criatura.',
        choices: ['is', 'am', 'are'],
      },
      acceptedAnswers: ['is'],
      explanation: 'Biscuit é "it"/"he" — terceira pessoa do singular: is.',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.affirmative'],
    },
    {
      slug: 'a1-reply-nice-to-meet-you',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Alguém diz "Nice to meet you!". O que você responde?',
      content: {
        options: [
          { id: 'too', text: 'Nice to meet you too.' },
          { id: 'thanks', text: 'Thank you very much.' },
          { id: 'fine', text: "I'm fine, thanks." },
        ],
        correctOptionIds: ['too'],
        shuffle: true,
      },
      explanation:
        'A resposta pronta é a mesma frase com "too" no fim. Não precisa inventar.',
      cefrLevel: 'A1',
      skillIds: ['chunk.nice-to-meet-you', 'function.introduce-yourself'],
    },
    {
      slug: 'a1-order-nice-to-meet-you',
      type: 'ORDER_WORDS',
      prompt: 'Monte a frase de quando você conhece alguém.',
      content: { tokens: ['meet', 'Nice', 'you', 'to'] },
      acceptedAnswers: ['Nice to meet you'],
      explanation:
        'É um bloco pronto: "Nice to meet you". Decore inteiro, não palavra por palavra.',
      cefrLevel: 'A1',
      skillIds: ['chunk.nice-to-meet-you'],
    },
    {
      slug: 'a1-type-shes-from-austin',
      type: 'TYPE_ANSWER',
      prompt: 'Escreva em inglês: "Ela é de Austin."',
      content: { sourceText: 'Ela é de Austin.', hint: 'Use a forma curta.' },
      acceptedAnswers: ["She's from Austin"],
      explanation:
        '"Ela é" vira "She is", e na fala "She\'s". "De Austin" é "from Austin".',
      errorPatternMap: { 'She from Austin': 'l1.missing-subject' },
      cefrLevel: 'A1',
      skillIds: [
        'grammar.be.present.affirmative',
        'grammar.contractions.be',
        'chunk.where-are-you-from',
      ],
    },

    // --- banco extra ---
    {
      slug: 'a1-be-she-is-from-campinas',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Complete: She ___ from Campinas.',
      content: {
        options: [
          { id: 'is', text: 'is' },
          { id: 'am', text: 'am' },
          { id: 'are', text: 'are' },
        ],
        correctOptionIds: ['is'],
        shuffle: true,
      },
      explanation: 'He, she e it pedem "is".',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.affirmative'],
    },
    {
      slug: 'a1-fill-are-you-new-here',
      type: 'FILL_BLANK',
      prompt: 'Complete a pergunta.',
      content: { sentence: '___ you new here?', hint: 'A pergunta inverte.' },
      acceptedAnswers: ['Are'],
      explanation:
        'Na pergunta com to be, o verbo vem antes do sujeito: Are you...?',
      errorPatternMap: { 'You are': 'word-order.question' },
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.questions'],
    },
    {
      slug: 'a1-match-pronoun-be',
      type: 'MATCH',
      prompt: 'Ligue cada pronome à forma certa do verbo to be.',
      content: {
        pairs: [
          { left: 'I', right: 'am' },
          { left: 'he', right: 'is' },
          { left: 'they', right: 'are' },
        ],
      },
      explanation: 'I → am; he, she, it → is; you, we, they → are.',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.affirmative', 'grammar.subject-pronouns'],
    },
    {
      slug: 'a1-dictation-im-from-brazil',
      type: 'DICTATION',
      prompt: 'Ouça e escreva exatamente o que você ouviu.',
      content: {
        audioText: "I'm from Brazil.",
        audioAssetId: dictation,
        maxPlays: 3,
      },
      acceptedAnswers: ["I'm from Brazil."],
      explanation: 'A forma curta "I\'m" é o que se ouve na fala normal.',
      cefrLevel: 'A1',
      skillIds: ['register.contracted-be', 'chunk.where-are-you-from'],
    },
    {
      slug: 'a1-register-you-coming',
      type: 'REGISTER_SWAP',
      prompt: 'Reescreva na estrutura gramatical completa.',
      content: {
        source: 'You coming?',
        direction: 'SPOKEN_TO_STANDARD',
        registerNoteId: 'you-coming',
      },
      acceptedAnswers: ['Are you coming?'],
      explanation:
        'Na fala o "are" some. Na forma completa ele volta para o começo.',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.questions', 'register.contracted-be'],
    },
    {
      slug: 'a1-register-gonna',
      type: 'REGISTER_SWAP',
      prompt: 'Reescreva do jeito que se fala.',
      content: {
        source: 'I am going to call you.',
        direction: 'STANDARD_TO_SPOKEN',
        registerNoteId: 'gonna',
      },
      acceptedAnswers: ["I'm gonna call you."],
      explanation:
        '"going to" antes de verbo vira "gonna", e "I am" vira "I\'m".',
      cefrLevel: 'A1',
      skillIds: ['register.gonna'],
    },
    {
      slug: 'a1-reading-lucas-austin',
      type: 'READING_COMPREHENSION',
      prompt: 'Where is Lucas from?',
      content: {
        passage:
          "Lucas is 24. He's from Campinas, near São Paulo. He lives in Austin now, in apartment 4A. His neighbor is Maya. She's from Texas.",
        passageTranslation:
          'Lucas tem 24 anos. Ele é de Campinas, perto de São Paulo. Agora mora em Austin, no apartamento 4A. A vizinha dele é a Maya. Ela é do Texas.',
        spans: [],
        options: [
          { id: 'campinas', text: 'Campinas' },
          { id: 'austin', text: 'Austin' },
          { id: 'texas', text: 'Texas' },
        ],
        correctOptionIds: ['campinas'],
        shuffle: true,
      },
      explanation:
        'O texto diz onde ele mora hoje (Austin) e de onde ele é (Campinas). A pergunta é a origem.',
      cefrLevel: 'A1',
      skillIds: ['chunk.where-are-you-from', 'vocab.countries-nationalities'],
    },
    {
      slug: 'a1-type-im-from-brazil',
      type: 'TYPE_ANSWER',
      prompt: 'Escreva em inglês: "Eu sou do Brasil."',
      content: { sourceText: 'Eu sou do Brasil.' },
      acceptedAnswers: ["I'm from Brazil"],
      explanation: 'País não leva "the": from Brazil, não "from the Brazil".',
      errorPatternMap: { "I'm from the Brazil": 'article.country-the' },
      cefrLevel: 'A1',
      skillIds: ['chunk.where-are-you-from', 'vocab.countries-nationalities'],
    },
    {
      slug: 'a1-short-answer-yes-i-am',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Are you Brazilian? Responda que sim.',
      content: {
        options: [
          { id: 'full', text: 'Yes, I am.' },
          { id: 'contracted', text: "Yes, I'm." },
          { id: 'bare', text: 'Yes, I.' },
        ],
        correctOptionIds: ['full'],
        shuffle: true,
      },
      explanation:
        'Na resposta curta afirmativa o verbo fica no fim e não encurta.',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.short-answers'],
    },
    {
      slug: 'a1-order-where-are-you-from',
      type: 'ORDER_WORDS',
      prompt: 'Monte a pergunta sobre a origem de alguém.',
      content: { tokens: ['you', 'Where', 'from', 'are'] },
      acceptedAnswers: ['Where are you from?'],
      explanation: 'Palavra de pergunta + verbo + sujeito: Where are you from?',
      errorPatternMap: { 'Where you are from': 'word-order.question' },
      cefrLevel: 'A1',
      skillIds: ['chunk.where-are-you-from', 'grammar.be.present.questions'],
    },
    {
      slug: 'a1-fill-hes-very-friendly',
      type: 'FILL_BLANK',
      prompt: 'Complete com a forma curta.',
      content: {
        sentence: 'This is Biscuit. ___ very friendly.',
        hint: 'Biscuit é um cachorro — use "he".',
      },
      acceptedAnswers: ["He's"],
      explanation: '"He is" na fala vira "He\'s".',
      errorPatternMap: { Is: 'l1.missing-subject' },
      cefrLevel: 'A1',
      skillIds: ['grammar.contractions.be', 'register.contracted-be'],
    },
    {
      slug: 'a1-article-a-dog',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Complete: Biscuit is ___ dog.',
      content: {
        options: [
          { id: 'a', text: 'a' },
          { id: 'an', text: 'an' },
          { id: 'the', text: 'the' },
        ],
        correctOptionIds: ['a'],
        shuffle: true,
      },
      explanation: '"dog" começa com som de consoante, então é "a".',
      cefrLevel: 'A1',
      skillIds: ['grammar.articles.a-an'],
    },
    {
      slug: 'a1-type-my-name-is-maya',
      type: 'TYPE_ANSWER',
      prompt: 'Escreva em inglês: "Meu nome é Maya."',
      content: { sourceText: 'Meu nome é Maya.' },
      acceptedAnswers: ['My name is Maya'],
      explanation:
        'Dá para dizer "My name is Maya" ou, mais curto, "I\'m Maya".',
      cefrLevel: 'A1',
      skillIds: ['chunk.my-name-is', 'grammar.possessive-adjectives'],
    },
  ];
}
