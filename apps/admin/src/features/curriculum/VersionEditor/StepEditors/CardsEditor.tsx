import type { ExplanationCardsContent, Span } from '@english-saas/shared';
import { Button, Input, MarkdownLite, Textarea } from '@english-saas/ui';
import { Plus, Trash2 } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../components/ListItemCard';
import { MarkedTextField } from '../../components/MarkedTextField';
import {
  insertAt,
  moveItem,
  removeAt,
  replaceAt,
  withOptional,
} from '../../lib/list-ops';
import {
  emptyCard,
  emptyExample,
  type StepContent,
} from '../../lib/step-content';
import { issuesAt, path } from '../../lib/validation';
import type { StepEditorProps } from './types';

type Card = ExplanationCardsContent['cards'][number];
type Table = NonNullable<Card['table']>;

const EMPTY_TABLE: Table = { headers: ['', ''], rows: [['', '']] };

function TableEditor({
  table,
  base,
  issues,
  readOnly,
  onChange,
}: {
  table: Table;
  base: string;
  issues: StepEditorProps['issues'];
  readOnly: boolean;
  onChange: (table: Table | undefined) => void;
}) {
  const columns = table.headers.length;

  return (
    <div
      data-field={base}
      className="space-y-2 rounded-lg border border-line p-3"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr>
              {table.headers.map((header, column) => (
                <th key={column} className="p-1 text-left">
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={t('cards.table.header', { n: column + 1 })}
                      value={header}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onChange({
                          ...table,
                          headers: replaceAt(
                            table.headers,
                            column,
                            event.target.value,
                          ),
                        })
                      }
                    />
                    {readOnly || columns <= 1 ? null : (
                      <button
                        type="button"
                        aria-label={t('cards.table.removeColumn', {
                          n: column + 1,
                        })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ground"
                        onClick={() =>
                          onChange({
                            headers: removeAt(table.headers, column),
                            rows: table.rows.map((row) =>
                              removeAt(row, column),
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => (
                  <td key={column} className="p-1">
                    <Input
                      aria-label={t('cards.table.cell', {
                        row: rowIndex + 1,
                        col: column + 1,
                      })}
                      value={cell}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onChange({
                          ...table,
                          rows: replaceAt(
                            table.rows,
                            rowIndex,
                            replaceAt(row, column, event.target.value),
                          ),
                        })
                      }
                    />
                  </td>
                ))}
                <td className="p-1">
                  {readOnly || table.rows.length <= 1 ? null : (
                    <button
                      type="button"
                      aria-label={t('cards.table.removeRow', {
                        n: rowIndex + 1,
                      })}
                      className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-ground"
                      onClick={() =>
                        onChange({
                          ...table,
                          rows: removeAt(table.rows, rowIndex),
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issuesAt(issues, path(base, 'rows'))[0] ? (
        <p className="text-sm text-error">
          {issuesAt(issues, path(base, 'rows'))[0]}
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={columns >= 6}
            onClick={() =>
              onChange({
                headers: [...table.headers, ''],
                rows: table.rows.map((row) => [...row, '']),
              })
            }
          >
            {t('cards.table.addColumn')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={table.rows.length >= 20}
            onClick={() =>
              onChange({
                ...table,
                rows: [...table.rows, table.headers.map(() => '')],
              })
            }
          >
            {t('cards.table.addRow')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            {t('cards.table.remove')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function CardsEditor({
  content,
  onChange,
  issues,
  readOnly,
}: StepEditorProps) {
  const cards = (content as unknown as ExplanationCardsContent).cards;

  function updateCards(next: Card[]): void {
    onChange({ ...content, cards: next } as StepContent);
  }

  function updateCard(index: number, card: Card): void {
    updateCards(replaceAt(cards, index, card));
  }

  return (
    <div className="space-y-4">
      {issuesAt(issues, 'cards')[0] ? (
        <p className="text-sm text-error">{issuesAt(issues, 'cards')[0]}</p>
      ) : null}
      <ol className="space-y-4">
        {cards.map((card, index) => {
          const base = path('cards', index);

          return (
            <ListItemCard
              key={index}
              title={`${String(index + 1)}. ${t('cards.card', { n: index + 1 })}`}
              label={t('cards.card', { n: index + 1 })}
              index={index}
              count={cards.length}
              readOnly={readOnly}
              fieldPath={base}
              onMove={(delta) => updateCards(moveItem(cards, index, delta))}
              onRemove={
                cards.length > 1
                  ? () => updateCards(removeAt(cards, index))
                  : undefined
              }
            >
              <Input
                label={t('cards.title')}
                value={card.title ?? ''}
                readOnly={readOnly}
                onChange={(event) =>
                  updateCard(index, { ...card, title: event.target.value })
                }
                error={issuesAt(issues, path(base, 'title'))[0]}
                data-field={path(base, 'title')}
              />
              <Textarea
                label={t('cards.body')}
                hint={t('cards.bodyHint')}
                value={card.bodyMd ?? ''}
                readOnly={readOnly}
                rows={5}
                onChange={(event) =>
                  updateCard(index, { ...card, bodyMd: event.target.value })
                }
                error={issuesAt(issues, path(base, 'bodyMd'))[0]}
                data-field={path(base, 'bodyMd')}
              />
              {card.bodyMd ? (
                <div className="rounded-lg bg-ground px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-muted">
                    {t('cards.bodyPreview')}
                  </p>
                  <MarkdownLite text={card.bodyMd} />
                </div>
              ) : null}

              {card.table ? (
                <TableEditor
                  table={card.table}
                  base={path(base, 'table')}
                  issues={issues}
                  readOnly={readOnly}
                  onChange={(table) =>
                    updateCard(index, withTable(card, table))
                  }
                />
              ) : readOnly ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() =>
                    updateCard(index, withTable(card, EMPTY_TABLE))
                  }
                >
                  {t('cards.table.add')}
                </Button>
              )}

              <section className="space-y-3">
                <h5 className="text-sm font-medium text-ink">
                  {t('cards.examples')}
                </h5>
                <ol className="space-y-3">
                  {card.examples.map((example, exampleIndex) => {
                    const exampleBase = path(base, 'examples', exampleIndex);

                    return (
                      <ListItemCard
                        key={exampleIndex}
                        title={`${String(exampleIndex + 1)}. ${t('cards.example', { n: exampleIndex + 1 })}`}
                        label={t('cards.example', { n: exampleIndex + 1 })}
                        index={exampleIndex}
                        count={card.examples.length}
                        readOnly={readOnly}
                        fieldPath={exampleBase}
                        onMove={(delta) =>
                          updateCard(index, {
                            ...card,
                            examples: moveItem(
                              card.examples,
                              exampleIndex,
                              delta,
                            ),
                          })
                        }
                        onRemove={() =>
                          updateCard(index, {
                            ...card,
                            examples: removeAt(card.examples, exampleIndex),
                          })
                        }
                      >
                        <MarkedTextField
                          label={t('cards.example.text')}
                          text={example.text ?? ''}
                          spans={(example.spans ?? []) as Span[]}
                          onChange={(next) =>
                            updateCard(index, {
                              ...card,
                              examples: replaceAt(card.examples, exampleIndex, {
                                ...example,
                                ...next,
                              }),
                            })
                          }
                          textPath={path(exampleBase, 'text')}
                          spansPath={path(exampleBase, 'spans')}
                          issues={issues}
                          readOnly={readOnly}
                          maxLength={300}
                        />
                        <Input
                          label={t('cards.example.translation')}
                          value={example.translation ?? ''}
                          readOnly={readOnly}
                          onChange={(event) =>
                            updateCard(index, {
                              ...card,
                              examples: replaceAt(
                                card.examples,
                                exampleIndex,
                                withOptional(
                                  example,
                                  'translation',
                                  event.target.value,
                                ),
                              ),
                            })
                          }
                          error={
                            issuesAt(
                              issues,
                              path(exampleBase, 'translation'),
                            )[0]
                          }
                          data-field={path(exampleBase, 'translation')}
                        />
                      </ListItemCard>
                    );
                  })}
                </ol>
                {readOnly || card.examples.length >= 12 ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Plus className="size-4" aria-hidden="true" />}
                    onClick={() =>
                      updateCard(index, {
                        ...card,
                        examples: insertAt(
                          card.examples,
                          card.examples.length,
                          emptyExample() as Card['examples'][number],
                        ),
                      })
                    }
                  >
                    {t('cards.example.add')}
                  </Button>
                )}
              </section>
            </ListItemCard>
          );
        })}
      </ol>
      {readOnly || cards.length >= 12 ? null : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() =>
            updateCards(insertAt(cards, cards.length, emptyCard() as Card))
          }
        >
          {t('cards.add')}
        </Button>
      )}
    </div>
  );
}

/** Põe ou tira a tabela do card: sem tabela, a chave nem existe. */
function withTable(card: Card, table: Table | undefined): Card {
  const { table: _removed, ...rest } = card;

  return table === undefined ? (rest as Card) : { ...rest, table };
}
