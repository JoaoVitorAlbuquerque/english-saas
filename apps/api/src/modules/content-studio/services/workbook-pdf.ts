import { createElement, type ReactElement } from 'react';

/**
 * Montagem do PDF da apostila.
 *
 * ### Por que a importação é assim
 *
 * `@react-pdf/renderer` 4.x é **ESM puro** (`"type": "module"`, sem build
 * CJS). A API roda em CommonJS e o Jest também, então um `import` no topo
 * derrubaria todo teste que carregasse este arquivo — foi exatamente o que
 * aconteceu com `@nestjs/event-emitter@12` no módulo 1 (ver CLAUDE.md).
 *
 * `import()` também não resolve sozinho: o TypeScript rebaixa para `require`
 * quando o alvo é CommonJS. O `new Function` preserva um `import()` de
 * verdade, que o Node resolve pelo carregador ESM nativo.
 *
 * O custo fica contido neste arquivo: ninguém mais precisa saber disso, e o
 * módulo só é carregado quando um PDF é gerado de fato.
 */

type ReactPdf = typeof import('@react-pdf/renderer');

let cached: Promise<ReactPdf> | undefined;

function loadReactPdf(): Promise<ReactPdf> {
  cached ??= (
    new Function(
      'return import("@react-pdf/renderer")',
    ) as () => Promise<ReactPdf>
  )();

  return cached;
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

export type WorkbookCard = {
  title: string;
  bodyMd: string;
  table: { headers: string[]; rows: string[][] } | null;
  examples: { text: string; translation: string | null }[];
};

export type WorkbookLesson = {
  title: string;
  objective: string;
  scene: {
    location: string;
    lines: {
      text: string;
      standardText: string | null;
      translation: string;
    }[];
  } | null;
  cards: WorkbookCard[];
  takeaways: string[];
};

export type WorkbookData = {
  unitSlug: string;
  unitTitle: string;
  unitSynopsis: string | null;
  levelTitle: string;
  cefrLevel: string;
  characters: { name: string; bio: string | null }[];
  lessons: WorkbookLesson[];
  registerNotes: {
    spokenForm: string;
    standardForm: string;
    explanation: string;
    whenToAvoid: string | null;
  }[];
};

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

const COLORS = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  rule: '#d8d8d8',
  accent: '#1f5f8b',
  highlight: '#f2f6f9',
};

function buildStyles(pdf: ReactPdf) {
  return pdf.StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 56,
      paddingHorizontal: 48,
      fontSize: 11,
      lineHeight: 1.5,
      color: COLORS.ink,
      fontFamily: 'Helvetica',
    },
    coverTitle: { fontSize: 28, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
    coverLevel: { fontSize: 13, color: COLORS.accent, marginBottom: 24 },
    h1: {
      fontSize: 18,
      marginTop: 20,
      marginBottom: 8,
      fontFamily: 'Helvetica-Bold',
    },
    h2: {
      fontSize: 13,
      marginTop: 14,
      marginBottom: 6,
      fontFamily: 'Helvetica-Bold',
    },
    h3: { fontSize: 11, marginTop: 10, marginBottom: 4, color: COLORS.accent },
    paragraph: { marginBottom: 6 },
    muted: { color: COLORS.muted, fontSize: 10 },
    rule: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.rule,
      marginVertical: 12,
    },
    line: { marginBottom: 8 },
    speaker: { fontFamily: 'Helvetica-Bold' },
    english: { marginBottom: 2 },
    translation: { color: COLORS.muted, fontSize: 10 },
    standard: { color: COLORS.accent, fontSize: 10 },
    box: {
      backgroundColor: COLORS.highlight,
      padding: 10,
      marginBottom: 10,
    },
    tableRow: { flexDirection: 'row' },
    tableCell: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.rule,
      padding: 5,
      fontSize: 10,
    },
    tableHeader: { fontFamily: 'Helvetica-Bold', backgroundColor: '#eeeeee' },
    footer: {
      position: 'absolute',
      bottom: 28,
      left: 48,
      right: 48,
      fontSize: 9,
      color: COLORS.muted,
      textAlign: 'center',
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function table(
  pdf: ReactPdf,
  styles: Styles,
  data: { headers: string[]; rows: string[][] },
  key: string,
): ReactElement {
  const { View, Text } = pdf;

  const row = (cells: string[], header: boolean, rowKey: string) =>
    createElement(
      View,
      { style: styles.tableRow, key: rowKey },
      ...cells.map((cell, index) =>
        createElement(
          Text,
          {
            style: header
              ? [styles.tableCell, styles.tableHeader]
              : styles.tableCell,
            key: `${rowKey}-${String(index)}`,
          },
          cell,
        ),
      ),
    );

  return createElement(
    View,
    { style: { marginBottom: 10 }, key },
    row(data.headers, true, `${key}-h`),
    ...data.rows.map((cells, index) =>
      row(cells, false, `${key}-r${String(index)}`),
    ),
  );
}

/**
 * Markdown vira texto puro.
 *
 * O corpo dos cards é markdown curto (negrito, lista, crase). Um parser de
 * verdade seria dependência nova para pouco ganho num PDF — aqui a marcação
 * sai e o texto fica.
 */
export function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/~~([^~]*)~~/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*([^*]*)\*/g, '$1')
    .trim();
}

function lessonSection(
  pdf: ReactPdf,
  styles: Styles,
  lesson: WorkbookLesson,
  index: number,
): ReactElement {
  const { View, Text } = pdf;
  const key = `lesson-${String(index)}`;
  const children: ReactElement[] = [
    createElement(Text, { style: styles.h1, key: `${key}-t` }, lesson.title),
    createElement(
      Text,
      { style: [styles.muted, styles.paragraph], key: `${key}-o` },
      `Objetivo: ${lesson.objective}`,
    ),
  ];

  if (lesson.scene !== null) {
    children.push(
      createElement(Text, { style: styles.h2, key: `${key}-sh` }, 'A cena'),
      createElement(
        Text,
        { style: [styles.muted, styles.paragraph], key: `${key}-sl` },
        lesson.scene.location,
      ),
    );

    for (const [lineIndex, line] of lesson.scene.lines.entries()) {
      const lineKey = `${key}-l${String(lineIndex)}`;
      const parts: ReactElement[] = [
        createElement(
          Text,
          { style: styles.english, key: `${lineKey}-e` },
          line.text,
        ),
      ];

      if (line.standardText !== null) {
        parts.push(
          createElement(
            Text,
            { style: styles.standard, key: `${lineKey}-s` },
            `Estrutura completa: ${line.standardText}`,
          ),
        );
      }

      parts.push(
        createElement(
          Text,
          { style: styles.translation, key: `${lineKey}-t` },
          line.translation,
        ),
      );

      children.push(
        createElement(View, { style: styles.line, key: lineKey }, ...parts),
      );
    }
  }

  for (const [cardIndex, card] of lesson.cards.entries()) {
    const cardKey = `${key}-c${String(cardIndex)}`;

    children.push(
      createElement(
        Text,
        { style: styles.h2, key: `${cardKey}-t` },
        card.title,
      ),
      createElement(
        Text,
        { style: styles.paragraph, key: `${cardKey}-b` },
        stripMarkdown(card.bodyMd),
      ),
    );

    if (card.table !== null) {
      children.push(table(pdf, styles, card.table, `${cardKey}-tbl`));
    }

    for (const [exampleIndex, example] of card.examples.entries()) {
      const exampleKey = `${cardKey}-e${String(exampleIndex)}`;

      children.push(
        createElement(
          View,
          { style: styles.line, key: exampleKey },
          createElement(
            Text,
            { style: styles.english, key: `${exampleKey}-x` },
            example.text,
          ),
          ...(example.translation === null
            ? []
            : [
                createElement(
                  Text,
                  { style: styles.translation, key: `${exampleKey}-tr` },
                  example.translation,
                ),
              ]),
        ),
      );
    }
  }

  if (lesson.takeaways.length > 0) {
    children.push(
      createElement(Text, { style: styles.h2, key: `${key}-kh` }, 'O que fica'),
      createElement(
        View,
        { style: styles.box, key: `${key}-kb` },
        ...lesson.takeaways.map((takeaway, takeawayIndex) =>
          createElement(
            Text,
            { key: `${key}-k${String(takeawayIndex)}` },
            `• ${takeaway}`,
          ),
        ),
      ),
    );
  }

  return createElement(View, { key, break: index > 0 }, ...children);
}

function registerNotesSection(
  pdf: ReactPdf,
  styles: Styles,
  notes: WorkbookData['registerNotes'],
): ReactElement[] {
  if (notes.length === 0) {
    return [];
  }

  const { View, Text } = pdf;

  return [
    createElement(
      View,
      { key: 'notes', break: true },
      createElement(
        Text,
        { style: styles.h1, key: 'notes-t' },
        'Como se fala × estrutura gramatical',
      ),
      ...notes.map((note, index) =>
        createElement(
          View,
          { style: styles.box, key: `note-${String(index)}` },
          createElement(
            Text,
            { style: styles.h3, key: `note-${String(index)}-h` },
            `"${note.spokenForm}"  =  "${note.standardForm}"`,
          ),
          createElement(
            Text,
            { key: `note-${String(index)}-e` },
            stripMarkdown(note.explanation),
          ),
          ...(note.whenToAvoid === null
            ? []
            : [
                createElement(
                  Text,
                  { style: styles.muted, key: `note-${String(index)}-w` },
                  `Atenção: ${note.whenToAvoid}`,
                ),
              ]),
        ),
      ),
    ),
  ];
}

function buildDocument(pdf: ReactPdf, data: WorkbookData): ReactElement {
  const styles = buildStyles(pdf);
  const { Document, Page, View, Text } = pdf;

  const cover = createElement(
    View,
    { key: 'cover' },
    createElement(
      Text,
      { style: styles.coverTitle, key: 'cover-t' },
      data.unitTitle,
    ),
    createElement(
      Text,
      { style: styles.coverLevel, key: 'cover-l' },
      `${data.levelTitle} · ${data.cefrLevel}`,
    ),
    ...(data.unitSynopsis === null
      ? []
      : [
          createElement(
            Text,
            { style: styles.paragraph, key: 'cover-s' },
            data.unitSynopsis,
          ),
        ]),
    ...(data.characters.length === 0
      ? []
      : [
          createElement(
            Text,
            { style: styles.h2, key: 'cast-h' },
            'Personagens',
          ),
          ...data.characters.map((character, index) =>
            createElement(
              Text,
              { style: styles.line, key: `cast-${String(index)}` },
              `${character.name}${character.bio === null ? '' : ` — ${character.bio}`}`,
            ),
          ),
        ]),
    createElement(View, { style: styles.rule, key: 'cover-r' }),
  );

  return createElement(
    Document,
    {
      title: `Apostila — ${data.unitTitle}`,
      author: 'english-saas',
      language: 'pt-BR',
    },
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      cover,
      ...data.lessons.map((lesson, index) =>
        lessonSection(pdf, styles, lesson, index),
      ),
      ...registerNotesSection(pdf, styles, data.registerNotes),
      createElement(Text, {
        style: styles.footer,
        fixed: true,
        render: ({
          pageNumber,
          totalPages,
        }: {
          pageNumber: number;
          totalPages: number;
        }) => `${String(pageNumber)} / ${String(totalPages)}`,
      }),
    ),
  );
}

export async function renderWorkbookPdf(data: WorkbookData): Promise<Buffer> {
  const pdf = await loadReactPdf();

  return pdf.renderToBuffer(buildDocument(pdf, data));
}
