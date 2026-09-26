import type {
  CefrLevel,
  Competency,
  LearningGoal,
  RegisterLevel,
  SkillType,
} from '@prisma/client';

/**
 * Taxonomia inicial: 15 skills A1 (mais uma A2, de registro), 10 erros
 * típicos de brasileiro e 8 notas de registro falado cobrindo A1–B1.
 *
 * Os ids são slugs imutáveis — ver CLAUDE.md, "Conteúdo e versionamento".
 */

export type SeedSkill = {
  id: string;
  type: SkillType;
  competency: Competency;
  cefrLevel: CefrLevel;
  title: string;
  description: string;
  prerequisites?: string[];
  commonErrors?: string[];
  /** A que objetivos serve. Sem isso, serve a todos igualmente. */
  goals?: LearningGoal[];
};

export const SEED_SKILLS: SeedSkill[] = [
  {
    id: 'grammar.subject-pronouns',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Pronomes pessoais',
    description: 'I, you, he, she, it, we, they — quem faz a ação.',
  },
  {
    id: 'grammar.be.present.affirmative',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Verbo to be no presente: afirmativa',
    description: 'I am, you are, he/she/it is — dizer quem é e como está.',
    prerequisites: ['grammar.subject-pronouns'],
    commonErrors: [
      'l1.have-for-age',
      'l1.missing-subject',
      'be-vs-have.feelings',
    ],
  },
  {
    id: 'grammar.be.present.negative',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Verbo to be no presente: negativa',
    description: "I'm not, you aren't, he isn't.",
    prerequisites: ['grammar.be.present.affirmative'],
  },
  {
    id: 'grammar.be.present.questions',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Perguntas com to be',
    description: 'Are you new here? Is she from Brazil? O verbo vem antes.',
    prerequisites: ['grammar.be.present.affirmative'],
    commonErrors: ['word-order.question'],
  },
  {
    id: 'grammar.be.present.short-answers',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Respostas curtas com to be',
    description: "Yes, I am. / No, I'm not. Na afirmativa não encurta.",
    prerequisites: ['grammar.be.present.questions'],
    commonErrors: ['contraction.yes-im'],
  },
  {
    id: 'grammar.contractions.be',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Formas curtas do to be',
    description: "I'm, you're, he's, she's, it's — o que se usa na fala.",
    prerequisites: ['grammar.be.present.affirmative'],
    commonErrors: ['contraction.yes-im'],
  },
  {
    id: 'grammar.articles.a-an',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Artigos a e an',
    description: 'a dog, an apple — o som da palavra seguinte decide.',
    commonErrors: ['article.country-the'],
  },
  {
    id: 'grammar.possessive-adjectives',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'My, your, his, her',
    description: 'De quem é a coisa.',
    prerequisites: ['grammar.subject-pronouns'],
  },
  {
    id: 'grammar.word-order.adjective',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A1',
    title: 'Adjetivo antes do substantivo',
    description: 'a big house, não "a house big".',
    commonErrors: ['word-order.adjective'],
  },
  {
    id: 'chunk.nice-to-meet-you',
    type: 'CHUNK',
    competency: 'SPEAKING',
    cefrLevel: 'A1',
    title: 'Nice to meet you',
    description: 'A frase pronta de quando você conhece alguém — e a resposta.',
  },
  {
    id: 'chunk.where-are-you-from',
    type: 'CHUNK',
    competency: 'SPEAKING',
    cefrLevel: 'A1',
    title: "Where are you from? / I'm from ___",
    description: 'Perguntar e dizer de onde você é.',
    prerequisites: ['grammar.be.present.questions'],
    commonErrors: ['article.country-the'],
    goals: ['TRAVEL', 'CONVERSATION', 'MOVING_ABROAD'],
  },
  {
    id: 'chunk.my-name-is',
    type: 'CHUNK',
    competency: 'SPEAKING',
    cefrLevel: 'A1',
    title: "My name is ___ / I'm ___",
    description: 'Os dois jeitos de dizer o seu nome.',
  },
  {
    id: 'vocab.countries-nationalities',
    type: 'VOCAB_SET',
    competency: 'VOCABULARY',
    cefrLevel: 'A1',
    title: 'Países e nacionalidades',
    description: 'Brazil/Brazilian, the US/American, Spain/Spanish.',
    commonErrors: ['article.country-the'],
    goals: ['TRAVEL', 'MOVING_ABROAD'],
  },
  {
    id: 'vocab.numbers-1-20',
    type: 'VOCAB_SET',
    competency: 'VOCABULARY',
    cefrLevel: 'A1',
    title: 'Números de 1 a 20',
    description: 'Contar, dizer idade e número de apartamento.',
    commonErrors: ['l1.have-for-age'],
  },
  {
    id: 'function.introduce-yourself',
    type: 'FUNCTION',
    competency: 'SPEAKING',
    cefrLevel: 'A1',
    title: 'Se apresentar',
    description: 'Dizer nome e origem, e responder a uma apresentação.',
    prerequisites: ['chunk.my-name-is', 'chunk.where-are-you-from'],
    commonErrors: ['l1.have-for-age'],
    goals: ['CONVERSATION', 'WORK', 'TRAVEL', 'MOVING_ABROAD'],
  },
  {
    id: 'register.contracted-be',
    type: 'REGISTER',
    competency: 'LISTENING',
    cefrLevel: 'A1',
    title: "Na fala é I'm, he's, it's",
    description:
      'Reconhecer a forma curta no áudio, que é o que se ouve de verdade.',
    prerequisites: ['grammar.contractions.be'],
  },
  {
    id: 'register.gonna',
    type: 'REGISTER',
    competency: 'LISTENING',
    cefrLevel: 'A2',
    title: 'gonna no lugar de going to',
    description: 'Reconhecer e usar a forma falada de "going to".',
  },

  // Leitura: o que as questões de compreensão dos materiais gerados (13)
  // medem — entender o que um texto curto diz.
  {
    id: 'reading.short-texts',
    type: 'FUNCTION',
    competency: 'READING',
    cefrLevel: 'A1',
    title: 'Entender textos curtos',
    description: 'Achar num texto curto quem, o quê, onde e quando.',
  },

  // --- A2: passado. Sem lição ainda; o generator (13) já usa como alvo,
  // e é o passado que conta história.
  {
    id: 'grammar.past-simple.regular',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A2',
    title: 'Passado simples: verbos regulares',
    description: 'worked, lived, arrived — o -ed que marca o passado.',
    prerequisites: ['grammar.subject-pronouns'],
    commonErrors: ['past-simple.base-form'],
  },
  {
    id: 'grammar.past-simple.irregular',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A2',
    title: 'Passado simples: verbos irregulares',
    description: 'went, saw, made, took — os que não seguem o -ed.',
    prerequisites: ['grammar.past-simple.regular'],
    commonErrors: ['past-simple.base-form'],
  },
  {
    id: 'grammar.past-simple.negative-questions',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A2',
    title: 'Passado simples: negativa e pergunta',
    description: "didn't + verbo; Did you...? — o verbo volta para a base.",
    prerequisites: ['grammar.past-simple.irregular'],
  },
  {
    id: 'grammar.there-was-were',
    type: 'GRAMMAR',
    competency: 'GRAMMAR',
    cefrLevel: 'A2',
    title: 'There was / there were',
    description: 'O "havia" do inglês: there was a king, there were ships.',
    prerequisites: ['grammar.be.present.affirmative'],
  },
];

export type SeedErrorPattern = {
  id: string;
  description: string;
  example: string;
  correction: string;
  explanation: string;
};

export const SEED_ERROR_PATTERNS: SeedErrorPattern[] = [
  {
    id: 'l1.have-for-age',
    description: 'Usa "have" para idade, como em português.',
    example: 'I have 20 years.',
    correction: "I'm 20 years old.",
    explanation:
      'Em português a gente "tem" idade; em inglês a gente "é" a idade. Use o verbo to be: I am 20 (years old).',
  },
  {
    id: 'l1.missing-subject',
    description: 'Esquece o sujeito, que em português é opcional.',
    example: 'Is raining.',
    correction: "It's raining.",
    explanation:
      'Frase em inglês quase sempre precisa de sujeito. Quando não existe um, entra "it".',
  },
  {
    id: 'article.country-the',
    description: 'Põe "the" antes de nome de país que não leva artigo.',
    example: "I'm from the Brazil.",
    correction: "I'm from Brazil.",
    explanation:
      'A maioria dos países vai sem "the". As exceções são os nomes no plural ou com substantivo: the US, the Netherlands, the UK.',
  },
  {
    id: 'third-person-s',
    description: 'Esquece o -s da terceira pessoa no presente simples.',
    example: 'He live in Austin.',
    correction: 'He lives in Austin.',
    explanation:
      'Com he, she e it, o verbo no presente simples ganha -s. É o único lugar onde o verbo muda.',
  },
  {
    id: 'false-friend.pretend',
    description: 'Usa "pretend" achando que é "pretender".',
    example: 'I pretend to travel next year.',
    correction: 'I intend to travel next year.',
    explanation:
      '"Pretend" quer dizer fingir. Para pretender, use "intend to" ou "plan to".',
  },
  {
    id: 'be-vs-have.feelings',
    description: 'Usa "have" para sensação e estado.',
    example: 'I have cold.',
    correction: "I'm cold.",
    explanation:
      "Frio, calor, fome, sede e medo vêm com o verbo to be: I'm cold, I'm hungry, I'm scared.",
  },
  {
    id: 'l1.people-is',
    description: 'Trata "people" como singular.',
    example: 'The people is very nice.',
    correction: 'The people are very nice.',
    explanation:
      '"People" já é plural — o plural de "person". Então pede "are".',
  },
  {
    id: 'word-order.adjective',
    description: 'Põe o adjetivo depois do substantivo.',
    example: 'I live in a house big.',
    correction: 'I live in a big house.',
    explanation:
      'Em inglês o adjetivo vem antes do substantivo, ao contrário do português.',
  },
  {
    id: 'word-order.question',
    description: 'Faz pergunta sem inverter, só pela entonação.',
    example: 'You are new here?',
    correction: 'Are you new here?',
    explanation:
      'Na pergunta com to be, o verbo vem antes do sujeito. A forma sem inversão existe, mas é só na conversa bem informal.',
  },
  {
    id: 'contraction.yes-im',
    description: 'Encurta o to be numa resposta curta afirmativa.',
    example: "Yes, I'm.",
    correction: 'Yes, I am.',
    explanation:
      "Na resposta curta afirmativa o verbo fica no fim da frase, e aí não encurta. Na negativa pode: No, I'm not.",
  },
  {
    id: 'past-simple.base-form',
    description: 'Usa o verbo na forma base para falar do passado.',
    example: 'Yesterday I go to the beach.',
    correction: 'Yesterday I went to the beach.',
    explanation:
      'Em português o tempo aparece no verbo e no contexto; em inglês o verbo precisa ir para o passado mesmo com "yesterday" na frase.',
  },
];

export type SeedRegisterNote = {
  id: string;
  spokenForm: string;
  standardForm: string;
  register: RegisterLevel;
  explanation: string;
  whenToAvoid: string | null;
  cefrLevel: CefrLevel;
  skillId: string | null;
};

export const SEED_REGISTER_NOTES: SeedRegisterNote[] = [
  {
    id: 'im-contraction',
    spokenForm: "I'm",
    standardForm: 'I am',
    register: 'INFORMAL_SPOKEN',
    explanation:
      'Na conversa, "I am" vira "I\'m" quase sempre. Dizer "I am" inteiro soa enfático, como se você estivesse insistindo.',
    whenToAvoid:
      'Em resposta curta afirmativa não encurta: "Yes, I am", nunca "Yes, I\'m".',
    cefrLevel: 'A1',
    skillId: 'register.contracted-be',
  },
  {
    id: 'be-contraction-third',
    spokenForm: "he's / she's / it's",
    standardForm: 'he is / she is / it is',
    register: 'INFORMAL_SPOKEN',
    explanation:
      'A forma curta é o padrão na fala. No áudio, o "is" some quase por completo e sobra um "z" colado na palavra.',
    whenToAvoid: 'Em texto formal escrito, prefira a forma inteira.',
    cefrLevel: 'A1',
    skillId: null,
  },
  {
    id: 'dropped-it-is',
    spokenForm: 'Cute dog!',
    standardForm: "It's a cute dog!",
    register: 'INFORMAL_SPOKEN',
    explanation:
      'Em exclamação curta, o inglês falado corta o sujeito e o verbo. É o mesmo movimento do português: "que cachorro fofo!".',
    whenToAvoid: 'Só na fala e em mensagem. Em texto, a frase precisa inteira.',
    cefrLevel: 'A1',
    skillId: null,
  },
  {
    id: 'you-coming',
    spokenForm: 'You coming?',
    standardForm: 'Are you coming?',
    register: 'INFORMAL_SPOKEN',
    explanation:
      'Na pergunta informal, o "are" some. Entender isso é o que separa ouvir a frase de ouvir um ruído.',
    whenToAvoid: 'Não use por escrito num contexto profissional.',
    cefrLevel: 'A2',
    skillId: null,
  },
  {
    id: 'gonna',
    spokenForm: 'gonna',
    standardForm: 'going to',
    register: 'INFORMAL_SPOKEN',
    explanation:
      '"going to" vira "gonna" quando vem antes de um verbo: I\'m gonna call you. Antes de substantivo não vira — "I\'m going to the store" continua inteiro.',
    whenToAvoid: 'Não escreva "gonna" em e-mail formal nem em prova.',
    cefrLevel: 'A2',
    skillId: 'register.gonna',
  },
  {
    id: 'wanna',
    spokenForm: 'wanna',
    standardForm: 'want to',
    register: 'INFORMAL_SPOKEN',
    explanation: '"want to" vira "wanna" na fala: I wanna go home.',
    whenToAvoid: 'Mesma regra do "gonna": só na fala e em mensagem.',
    cefrLevel: 'A2',
    skillId: null,
  },
  {
    id: 'gotta',
    spokenForm: 'gotta',
    standardForm: 'have got to / have to',
    register: 'INFORMAL_SPOKEN',
    explanation:
      '"I\'ve got to go" vira "I gotta go". Carrega uma urgência que o "have to" sozinho não tem.',
    whenToAvoid: 'Fora da conversa, use "have to".',
    cefrLevel: 'B1',
    skillId: null,
  },
  {
    id: 'whatcha-doing',
    spokenForm: 'Whatcha doing?',
    standardForm: 'What are you doing?',
    register: 'INFORMAL_SPOKEN',
    explanation:
      '"what are you" desaba em "whatcha". Você não vai precisar dizer, mas vai precisar reconhecer em série e filme.',
    whenToAvoid: 'Nunca por escrito, a não ser reproduzindo fala.',
    cefrLevel: 'B1',
    skillId: null,
  },
];
