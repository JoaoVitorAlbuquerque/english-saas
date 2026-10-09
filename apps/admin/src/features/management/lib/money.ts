const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Centavos em texto: `6990` → `R$ 69,90`. */
export function formatBrlCents(cents: number): string {
  // O espaço entre o símbolo e o número é inseparável; um comum lê melhor e testa melhor.
  return brl.format(cents / 100).replace(/\p{Zs}/gu, ' ');
}

/** Só o número, para um campo de edição: `6990` → `69,90`. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * O que o admin digitou em reais, em centavos. Aceita `69,90`, `69.90`,
 * `R$ 1.234,56` e `1234`; devolve `null` para o que não é dinheiro (vazio,
 * negativo, mais de duas casas, letra).
 */
export function parseBrlToCents(input: string): number | null {
  const text = input
    .replace(/R\$/gi, '')
    .replace(/\p{Zs}/gu, '')
    .trim();

  if (text === '') {
    return null;
  }

  let normalized: string;

  if (text.includes(',')) {
    // Vírgula é o decimal; ponto antes dela é milhar.
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // `1.234` sem vírgula: milhar, não decimal.
    normalized = text.replace(/\./g, '');
  } else {
    normalized = text;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
}
