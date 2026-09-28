import { Fragment } from 'react';

/**
 * Markdown "curto" dos cards de explicação (`bodyMd` — CLAUDE.md: só negrito,
 * código inline, riscado e parágrafos/lista). Sem biblioteca nova: o
 * conteúdo é curto e autorado só pela edição interna, não é HTML de
 * terceiros.
 */

const INLINE_PATTERN = /(\*\*.+?\*\*|`.+?`|~~.+?~~)/g;

function renderInline(text: string, keyPrefix: string) {
  return text.split(INLINE_PATTERN).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-ground px-1 py-0.5 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <s key={key}>{part.slice(2, -2)}</s>;
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MarkdownLite({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n').filter((line) => line.length > 0);
        const isList =
          lines.length > 0 && lines.every((line) => line.startsWith('- '));

        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.slice(2), `${index}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, `${index}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
