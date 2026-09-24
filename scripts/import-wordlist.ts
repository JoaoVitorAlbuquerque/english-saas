/**
 * Gera `packages/shared/src/wordlists/<idioma>.generated.ts` a partir do CSV
 * versionado em `packages/shared/data/`.
 *
 *   pnpm wordlist:import            # en
 *   pnpm wordlist:import -- --lang en --check
 *
 * O CSV tem quatro colunas: `word,cefr,rank,source`. Cada `source` precisa
 * estar declarada em `wordlist-en.sources.json` com nome, licença e URL —
 * nenhuma palavra entra sem procedência, e a atribuição viaja para dentro do
 * arquivo gerado.
 *
 * `--check` não escreve nada: falha se o arquivo gerado estiver diferente do
 * que o CSV produziria. Serve para o CI acusar CSV editado sem rodar o
 * import.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];

type SourceMeta = {
  name: string;
  license: string;
  url: string;
  note?: string;
};

type Entry = {
  word: string;
  cefr: CefrLevel;
  rank: number;
  source: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function parseArgs(argv: string[]): { lang: string; check: boolean } {
  const lang = argv.includes('--lang')
    ? (argv[argv.indexOf('--lang') + 1] ?? 'en')
    : 'en';

  return { lang, check: argv.includes('--check') };
}

/**
 * Leitor de CSV mínimo: sem aspas, sem vírgula dentro de campo. A lista é
 * palavra/nível/rank/fonte — se um dia precisar de vírgula, troque por um
 * parser de verdade em vez de remendar este.
 */
function parseCsv(raw: string): Entry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const header = lines.shift();

  if (header !== 'word,cefr,rank,source') {
    throw new Error(
      `Cabeçalho inesperado: "${String(header)}". Esperado "word,cefr,rank,source".`,
    );
  }

  const seen = new Map<string, number>();

  return lines.map((line, index) => {
    const parts = line.split(',');

    if (parts.length !== 4) {
      throw new Error(
        `Linha ${String(index + 2)}: esperava 4 colunas, veio ${String(parts.length)} — "${line}".`,
      );
    }

    const [rawWord, rawCefr, rawRank, rawSource] = parts as [
      string,
      string,
      string,
      string,
    ];
    const word = rawWord.trim().toLowerCase();
    const cefr = rawCefr.trim().toUpperCase();
    const rank = Number(rawRank.trim());
    const source = rawSource.trim();

    if (!/^[a-z][a-z'-]*$/.test(word)) {
      throw new Error(
        `Linha ${String(index + 2)}: "${rawWord}" não parece uma palavra (minúsculas, apóstrofo e hífen).`,
      );
    }

    if (!CEFR_LEVELS.includes(cefr as CefrLevel)) {
      throw new Error(
        `Linha ${String(index + 2)}: nível "${rawCefr}" desconhecido.`,
      );
    }

    if (!Number.isInteger(rank) || rank < 1) {
      throw new Error(
        `Linha ${String(index + 2)}: rank "${rawRank}" precisa ser inteiro positivo.`,
      );
    }

    const previous = seen.get(word);

    if (previous !== undefined) {
      throw new Error(
        `Linha ${String(index + 2)}: "${word}" já apareceu na linha ${String(previous)}.`,
      );
    }

    seen.set(word, index + 2);

    return { word, cefr: cefr as CefrLevel, rank, source };
  });
}

function render(
  lang: string,
  entries: Entry[],
  sources: Record<string, SourceMeta>,
): string {
  const used = [...new Set(entries.map((entry) => entry.source))].sort();
  const byLevel = Object.fromEntries(
    CEFR_LEVELS.map((level) => [
      level,
      entries.filter((entry) => entry.cefr === level).length,
    ]),
  );

  const sorted = [...entries].sort(
    (a, b) => a.rank - b.rank || a.word.localeCompare(b.word),
  );

  const rows = sorted
    .map(
      (entry) =>
        `  ['${entry.word.replace(/'/g, "\\'")}', '${entry.cefr}', ${String(entry.rank)}],`,
    )
    .join('\n');

  const attribution = used
    .map((key) => {
      const meta = sources[key];

      if (meta === undefined) {
        throw new Error(
          `A fonte "${key}" aparece no CSV mas não está declarada em wordlist-${lang}.sources.json.`,
        );
      }

      return `  {\n    key: '${key}',\n    name: ${JSON.stringify(meta.name)},\n    license: ${JSON.stringify(meta.license)},\n    url: ${JSON.stringify(meta.url)},\n  },`;
    })
    .join('\n');

  const counts = CEFR_LEVELS.map(
    (level) => `${level}: ${String(byLevel[level] ?? 0)}`,
  ).join(', ');

  return `/* eslint-disable */
// GERADO POR scripts/import-wordlist.ts — NÃO EDITE À MÃO.
//
// Fonte: packages/shared/data/wordlist-${lang}.csv
// Para mudar a lista, edite o CSV e rode \`pnpm wordlist:import\`.
//
// Distribuição por nível: ${counts}.

import type { CefrLevel } from '../cefr';

/** Procedência e licença de cada fonte usada nesta lista. */
export const ${lang.toUpperCase()}_WORDLIST_SOURCES: {
  key: string;
  name: string;
  license: string;
  url: string;
}[] = [
${attribution}
];

/** \`[palavra, banda CEFR, rank de frequência]\`, ordenado por rank. */
export const ${lang.toUpperCase()}_WORDLIST_ENTRIES: [string, CefrLevel, number][] = [
${rows}
];
`;
}

function main(): void {
  const { lang, check } = parseArgs(process.argv.slice(2));
  const csvPath = join(root, 'packages/shared/data', `wordlist-${lang}.csv`);
  const sourcesPath = join(
    root,
    'packages/shared/data',
    `wordlist-${lang}.sources.json`,
  );
  const outPath = join(
    root,
    'packages/shared/src/wordlists',
    `${lang}.generated.ts`,
  );

  const entries = parseCsv(readFileSync(csvPath, 'utf8'));
  const { sources } = JSON.parse(readFileSync(sourcesPath, 'utf8')) as {
    sources: Record<string, SourceMeta>;
  };

  const output = render(lang, entries, sources);

  if (check) {
    const current = readFileSync(outPath, 'utf8');

    if (hash(current) !== hash(output)) {
      console.error(
        `O arquivo gerado está desatualizado em relação ao CSV. Rode: pnpm wordlist:import -- --lang ${lang}`,
      );
      process.exit(1);
    }

    console.warn(
      `wordlist ${lang}: em dia (${String(entries.length)} palavras).`,
    );
    return;
  }

  writeFileSync(outPath, output, 'utf8');

  console.warn(
    `wordlist ${lang}: ${String(entries.length)} palavras de ${String(
      new Set(entries.map((entry) => entry.source)).size,
    )} fonte(s) → ${outPath}`,
  );
}

function hash(value: string): string {
  return createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
}

main();
