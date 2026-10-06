/**
 * Normalização de resposta digitada.
 *
 * O aluno escreve "she's from austin" e o gabarito diz "She is from Austin."
 * As duas coisas são a mesma resposta. Aqui a gente tira caixa, pontuação e
 * espaço sobrando, e trata contração como equivalente à forma expandida.
 *
 * Duas decisões que valem a pena conhecer:
 *
 * 1. **Contração ambígua vira variante, não uma escolha.** `she's` pode ser
 *    `she is` ou `she has`. Em vez de chutar, geramos as duas e comparamos
 *    conjunto com conjunto — senão "it's been" nunca casaria com
 *    "it has been".
 * 2. **Forma falada não é normalizada.** `gonna` continua `gonna`, `wanna`
 *    continua `wanna`. É exatamente a distinção que um item REGISTER_SWAP
 *    mede: expandir aqui apagaria a pergunta.
 */

/** Aspas curvas que celular e Word inserem no lugar do apóstrofo reto. */
const SMART_APOSTROPHES = /[‘’ʼ′]/g;

/** Pontuação descartada. O apóstrofo fica: ele carrega a contração. */
const PUNCTUATION = /[.,!?;:"“”()[\]{}…—–\-/\\]/g;

/** Contrações com uma expansão só. */
const FIXED_CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "it'll": 'it will',
  "we'll": 'we will',
  "they'll": 'they will',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "couldn't": 'could not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "mustn't": 'must not',
  "let's": 'let us',
};

/**
 * Bases que aceitam `'s` e `'d` como contração de verbo.
 *
 * É uma lista fechada de propósito: sem ela, `Maya's dog` viraria
 * `maya is dog` — possessivo não é contração.
 */
const CONTRACTIBLE_BASES = new Set([
  'i',
  'he',
  'she',
  'it',
  'that',
  'this',
  'there',
  'here',
  'what',
  'who',
  'where',
  'when',
  'why',
  'how',
  'everyone',
  'everybody',
  'everything',
  'nobody',
  'someone',
  'somebody',
  'something',
  'you',
  'we',
  'they',
]);

/** `'d` só contrai para esses; `'s` para is/has. */
const AMBIGUOUS_EXPANSIONS: Record<string, string[]> = {
  s: ['is', 'has'],
  d: ['would', 'had'],
};

/** Teto de combinações. Frase real não passa de duas contrações ambíguas. */
const MAX_VARIANTS = 16;

/** Caixa baixa, aspa reta, sem pontuação, espaço colapsado. */
function clean(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(SMART_APOSTROPHES, "'")
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Expansões possíveis de um token. Quase sempre uma só. */
function expandToken(token: string): string[] {
  const fixed = FIXED_CONTRACTIONS[token];

  if (fixed !== undefined) {
    return [fixed];
  }

  const match = /^([a-z]+)'([sd])$/.exec(token);

  if (match === null) {
    return [token];
  }

  const [, base, suffix] = match;

  if (
    base === undefined ||
    suffix === undefined ||
    !CONTRACTIBLE_BASES.has(base)
  ) {
    // Possessivo (`maya's`) ou algo que não é contração: fica como está.
    return [token];
  }

  const expansions = AMBIGUOUS_EXPANSIONS[suffix] ?? [];

  return expansions.map((verb) => `${base} ${verb}`);
}

/**
 * Todas as leituras plausíveis de uma resposta, já normalizadas.
 * Sempre devolve ao menos uma.
 */
export function answerVariants(text: string): string[] {
  const tokens = clean(text).split(' ').filter(Boolean);

  if (tokens.length === 0) {
    return [''];
  }

  let variants: string[][] = [[]];

  for (const token of tokens) {
    const expansions = expandToken(token);

    // Estourou o teto: daqui para a frente fica só a primeira leitura.
    const options =
      variants.length * expansions.length > MAX_VARIANTS
        ? expansions.slice(0, 1)
        : expansions;

    variants = variants.flatMap((prefix) =>
      options.map((option) => [...prefix, option]),
    );
  }

  return [...new Set(variants.map((parts) => parts.join(' ')))];
}

/**
 * Forma canônica de uma resposta: a primeira leitura, para guardar e
 * comparar chave de mapa. Para comparar respostas, use `matchesAnswer`.
 */
export function normalizeAnswer(text: string): string {
  return answerVariants(text)[0] ?? '';
}

/** A resposta do aluno bate com algum gabarito? */
export function matchesAnswer(
  given: string,
  accepted: readonly string[],
): boolean {
  if (accepted.length === 0) {
    return false;
  }

  const givenVariants = new Set(answerVariants(given));

  if (givenVariants.has('')) {
    return false;
  }

  return accepted.some((answer) =>
    answerVariants(answer).some((variant) => givenVariants.has(variant)),
  );
}

/**
 * Qual erro típico a resposta revela, se alguma entrada do mapa casar.
 * O mapa é autorado com a frase errada inteira, não com o id normalizado.
 */
export function findErrorPattern(
  given: string,
  errorPatternMap: Record<string, string>,
): string | undefined {
  const givenVariants = new Set(answerVariants(given));

  for (const [wrongAnswer, errorPatternId] of Object.entries(errorPatternMap)) {
    if (answerVariants(wrongAnswer).some((v) => givenVariants.has(v))) {
      return errorPatternId;
    }
  }

  return undefined;
}
