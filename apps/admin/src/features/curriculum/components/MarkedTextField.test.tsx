import { createQueryClient } from '@english-saas/api-client';
import type { Span } from '@english-saas/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { FieldIssue } from '../lib/validation';
import { MarkedTextField } from './MarkedTextField';

type Props = {
  initialText?: string;
  initialSpans?: Span[];
  issues?: FieldIssue[];
  readOnly?: boolean;
};

function Harness({
  initialText = "I'm gonna have a coffee.",
  initialSpans = [],
  issues = [],
  readOnly = false,
}: Props) {
  const [value, setValue] = useState({
    text: initialText,
    spans: initialSpans,
  });

  return (
    <>
      <MarkedTextField
        label="Texto da fala"
        text={value.text}
        spans={value.spans}
        onChange={setValue}
        textPath="lines.0.text"
        spansPath="lines.0.spans"
        issues={issues}
        readOnly={readOnly}
      />
      <pre data-testid="state">{JSON.stringify(value)}</pre>
    </>
  );
}

function renderField(props: Props = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

function state(): { text: string; spans: Span[] } {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

/** Seleciona `[start, end)` no campo, como o mouse faria. */
function select(start: number, end: number) {
  const input = screen.getByLabelText('Texto da fala') as HTMLInputElement;

  input.setSelectionRange(start, end);
  fireEvent.select(input);
}

describe('MarkedTextField — editor de marcações', () => {
  it('sem trecho selecionado, só explica como marcar', () => {
    renderField();

    expect(
      screen.getByText('Selecione um trecho do texto para marcá-lo.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marcar trecho' }),
    ).not.toBeInTheDocument();
  });

  it('marca um trecho como estrutura gramatical ligada a uma skill', async () => {
    renderField();

    select(4, 9);

    expect(screen.getByText('Trecho selecionado: "gonna"')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Estrutura gramatical' }),
    );

    // Sem skill, não dá para marcar.
    expect(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Escolha a skill ou a nota de registro para marcar.'),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Buscar skill por nome ou código'),
      'going to',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Futuro com going to/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    );

    expect(state().spans).toEqual([
      { start: 4, end: 9, kind: 'GRAMMAR', skillId: 'grammar.going-to-future' },
    ]);
    // A seleção e a escolha foram limpas.
    expect(
      screen.getByText('Selecione um trecho do texto para marcá-lo.'),
    ).toBeInTheDocument();
  });

  it('expressão pronta (CHUNK) também exige skill', async () => {
    renderField();

    select(0, 3);
    await userEvent.click(
      screen.getByRole('button', { name: 'Expressão pronta' }),
    );

    expect(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    ).toBeDisabled();

    await userEvent.click(
      await screen.findByRole('button', { name: /Nice to meet you/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    );

    expect(state().spans).toEqual([
      { start: 0, end: 3, kind: 'CHUNK', skillId: 'chunk.nice-to-meet-you' },
    ]);
  });

  it('jeito de falar (REGISTER) exige a nota de registro, não a skill', async () => {
    renderField();

    select(4, 9);
    await userEvent.click(
      screen.getByRole('button', { name: 'Jeito de falar' }),
    );

    expect(
      screen.queryByLabelText('Buscar skill por nome ou código'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    ).toBeDisabled();

    // As notas chegam do servidor: espera a opção existir.
    await screen.findByRole('option', { name: /gonna/ });
    await userEvent.selectOptions(
      screen.getByLabelText('Nota de registro'),
      'gonna',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    );

    expect(state().spans).toEqual([
      { start: 4, end: 9, kind: 'REGISTER', registerNoteId: 'gonna' },
    ]);
  });

  it('vocabulário não exige skill, mas leva a que for escolhida', async () => {
    renderField();

    select(15, 21);
    await userEvent.click(screen.getByRole('button', { name: 'Vocabulário' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    );

    expect(state().spans).toEqual([{ start: 15, end: 21, kind: 'VOCAB' }]);

    select(0, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Vocabulário' }));
    await userEvent.click(
      await screen.findByRole('button', { name: /Pedir um café/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar trecho' }),
    );

    expect(state().spans).toEqual([
      { start: 0, end: 3, kind: 'VOCAB', skillId: 'vocab.cafe' },
      { start: 15, end: 21, kind: 'VOCAB' },
    ]);
  });

  it('lista as marcações com o trecho e dá para remover', async () => {
    renderField({
      initialSpans: [
        { start: 4, end: 9, kind: 'REGISTER', registerNoteId: 'gonna' },
      ],
    });

    expect(screen.getByText('"gonna" · Jeito de falar')).toBeInTheDocument();
    expect(
      screen.getByText('gonna', { selector: 'span.font-mono' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remover marcação 1' }),
    );

    expect(state().spans).toEqual([]);
    expect(screen.getByText('Sem marcações neste texto.')).toBeInTheDocument();
  });

  it('o texto marcado aparece destacado em "Como fica"', () => {
    renderField({
      initialSpans: [
        {
          start: 4,
          end: 9,
          kind: 'GRAMMAR',
          skillId: 'grammar.going-to-future',
        },
      ],
    });

    const preview = screen.getByText('Como fica').parentElement as HTMLElement;

    expect(
      within(preview).getByRole('button', {
        name: 'Estrutura gramatical: gonna',
      }),
    ).toBeInTheDocument();
  });

  it('o erro da marcação aparece na linha dela, e o do texto no campo', () => {
    renderField({
      initialSpans: [
        { start: 0, end: 9, kind: 'VOCAB' },
        { start: 4, end: 12, kind: 'VOCAB' },
      ],
      issues: [
        {
          path: 'lines.0.spans.1',
          message: 'Duas marcações se sobrepõem no mesmo trecho.',
        },
        { path: 'lines.0.text', message: 'Use no máximo 5 caracteres.' },
      ],
    });

    const row = screen.getByText('"gonna ha" · Vocabulário').closest('li');

    expect(row).toHaveTextContent(
      'Duas marcações se sobrepõem no mesmo trecho.',
    );
    expect(screen.getByText('Use no máximo 5 caracteres.')).toBeInTheDocument();
  });

  describe('o texto muda e as marcações acompanham', () => {
    it('digitar antes do trecho desloca a marcação', async () => {
      renderField({
        initialSpans: [
          {
            start: 4,
            end: 9,
            kind: 'GRAMMAR',
            skillId: 'grammar.going-to-future',
          },
        ],
      });

      const input = screen.getByLabelText('Texto da fala') as HTMLInputElement;

      await userEvent.click(input);
      input.setSelectionRange(0, 0);
      await userEvent.keyboard('Oh, ');

      expect(state().text).toBe("Oh, I'm gonna have a coffee.");
      expect(state().spans).toEqual([
        {
          start: 8,
          end: 13,
          kind: 'GRAMMAR',
          skillId: 'grammar.going-to-future',
        },
      ]);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('apagar o trecho marcado remove a marcação e avisa', async () => {
      renderField({
        initialText: 'I gonna go',
        initialSpans: [
          {
            start: 2,
            end: 7,
            kind: 'GRAMMAR',
            skillId: 'grammar.going-to-future',
          },
        ],
      });

      const input = screen.getByLabelText('Texto da fala') as HTMLInputElement;

      await userEvent.click(input);
      input.setSelectionRange(2, 8);
      await userEvent.keyboard('{Backspace}');

      expect(state().text).toBe('I go');
      expect(state().spans).toEqual([]);
      expect(screen.getByRole('status')).toHaveTextContent(
        '1 marcação foi removida porque o texto dela foi cortado.',
      );
    });
  });

  it('somente leitura: sem controles de marcar nem de remover', () => {
    renderField({
      readOnly: true,
      initialSpans: [{ start: 0, end: 3, kind: 'VOCAB' }],
    });

    expect(screen.getByLabelText('Texto da fala')).toHaveAttribute('readonly');
    expect(
      screen.queryByText('Selecione um trecho do texto para marcá-lo.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remover marcação 1' }),
    ).not.toBeInTheDocument();
  });
});
