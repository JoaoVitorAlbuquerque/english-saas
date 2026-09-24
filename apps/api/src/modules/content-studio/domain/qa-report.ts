/**
 * Avisos de QA.
 *
 * O job de QA **nunca altera o conteúdo** — ele descreve o que viu e deixa a
 * decisão com o revisor. A única coisa que o resultado faz sozinho é travar:
 * um `BLOCKER` impede a aprovação da versão. `WARNING` e `INFO` aparecem na
 * tela e não impedem nada.
 */

export const QA_SEVERITIES = ['INFO', 'WARNING', 'BLOCKER'] as const;
export type QaSeverity = (typeof QA_SEVERITIES)[number];

/**
 * Catálogo dos avisos, com a gravidade de cada um.
 *
 * A gravidade mora aqui e não no lugar que gera o aviso: assim dá para ler a
 * política inteira num lugar só, e mudar "isto passa a barrar" é uma linha.
 */
export const QA_RULES = {
  /** Fração de palavras acima do nível passou do teto. */
  LEVEL_ABOVE_TARGET: 'WARNING',
  /** A lista de frequência cobriu pouco do texto — leia a razão com reserva. */
  LEVEL_LOW_COVERAGE: 'INFO',
  /** Skill-alvo da lição não aparece marcada em nenhuma cena ou card. */
  SKILL_NOT_IN_SPANS: 'WARNING',
  /** Skill-alvo da lição não é medida por nenhum item da prática. */
  SKILL_NOT_IN_ITEMS: 'WARNING',
  /** As peças de ORDER_WORDS não montam a resposta aceita. */
  ORDER_WORDS_TOKENS_MISMATCH: 'BLOCKER',
  /** Número de lacunas diferente do número de respostas. */
  FILL_BLANK_COUNT_MISMATCH: 'BLOCKER',
  /** Item de escolha sem gabarito válido. */
  ITEM_WITHOUT_ANSWER: 'BLOCKER',
  /** A explicação não cita a alternativa certa. */
  ANSWER_EXPLANATION_MISMATCH: 'INFO',
  /** O trecho que a IA mandou marcar não foi achado no texto. */
  SPAN_TEXT_NOT_FOUND: 'WARNING',
  /** A revisão linguística apontou erro de inglês. */
  LANGUAGE_ISSUE: 'WARNING',
  /** A revisão linguística apontou tradução ruim. */
  TRANSLATION_ISSUE: 'WARNING',
  /** A cena não tem fala de nenhum dos personagens pedidos. */
  CHARACTER_NOT_USED: 'INFO',
} as const satisfies Record<string, QaSeverity>;

export type QaCode = keyof typeof QA_RULES;

export type QaWarning = {
  code: QaCode;
  severity: QaSeverity;
  /** pt-BR, para o editor ler. */
  message: string;
  /** Onde: `steps.2.items.0`, `scene.lines.3`. */
  path?: string;
};

export type QaSummary = {
  blockerCount: number;
  warningCount: number;
  infoCount: number;
};

/** Monta um aviso já com a gravidade do catálogo. */
export function warn(code: QaCode, message: string, path?: string): QaWarning {
  return {
    code,
    severity: QA_RULES[code],
    message,
    ...(path === undefined ? {} : { path }),
  };
}

export function summarize(warnings: readonly QaWarning[]): QaSummary {
  return {
    blockerCount: warnings.filter((w) => w.severity === 'BLOCKER').length,
    warningCount: warnings.filter((w) => w.severity === 'WARNING').length,
    infoCount: warnings.filter((w) => w.severity === 'INFO').length,
  };
}

export function blockers(warnings: readonly QaWarning[]): QaWarning[] {
  return warnings.filter((warning) => warning.severity === 'BLOCKER');
}

export function hasBlockers(warnings: readonly QaWarning[]): boolean {
  return warnings.some((warning) => warning.severity === 'BLOCKER');
}

/** Ordena para a tela: o que trava primeiro, depois por caminho. */
export function sortWarnings(warnings: readonly QaWarning[]): QaWarning[] {
  const weight: Record<QaSeverity, number> = {
    BLOCKER: 0,
    WARNING: 1,
    INFO: 2,
  };

  return [...warnings].sort(
    (a, b) =>
      weight[a.severity] - weight[b.severity] ||
      (a.path ?? '').localeCompare(b.path ?? '') ||
      a.code.localeCompare(b.code),
  );
}
