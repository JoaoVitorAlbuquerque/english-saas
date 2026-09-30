import type { Span } from '@english-saas/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkedText } from './MarkedText';

const TEXT = "He's gonna call you later.";
const SPANS: Span[] = [{ start: 5, end: 10, kind: 'REGISTER' }];

describe('MarkedText', () => {
  it('divide o texto exatamente nos limites do span, sem perder nada', () => {
    const { container } = render(<MarkedText text={TEXT} spans={SPANS} />);

    expect(screen.getByRole('button')).toHaveTextContent('gonna');
    expect(container.textContent).toBe(TEXT);
  });

  it('sem spans, mostra o texto inteiro sem marcação', () => {
    render(<MarkedText text={TEXT} spans={[]} />);

    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('chama onSpanClick com o span e o trecho ao abrir o popover', async () => {
    const onSpanClick = vi.fn();
    render(<MarkedText text={TEXT} spans={SPANS} onSpanClick={onSpanClick} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onSpanClick).toHaveBeenCalledWith(SPANS[0], 'gonna');
  });

  it('describeSpan acrescenta a explicação no popover', async () => {
    render(
      <MarkedText
        text={TEXT}
        spans={SPANS}
        describeSpan={(_span, text) =>
          `"${text}" é o jeito falado de going to.`
        }
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(
      await screen.findByText('"gonna" é o jeito falado de going to.'),
    ).toBeInTheDocument();
  });
});
