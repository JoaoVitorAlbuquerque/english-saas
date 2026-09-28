import { ApiError, emitApiClientEvent } from '@english-saas/api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Paywall } from './Paywall';

describe('Paywall', () => {
  it('abre quando o evento plan-required chega, com a mensagem e o plano', async () => {
    render(<Paywall />);

    expect(screen.queryByText('Entendi')).not.toBeInTheDocument();

    emitApiClientEvent({
      type: 'plan-required',
      requiredPlan: 'PLUS',
      error: new ApiError({
        code: 'PLAN_REQUIRED',
        message: 'Essa lição é de um plano pago.',
        status: 403,
      }),
    });

    expect(await screen.findByText('Isso é do plano Plus')).toBeInTheDocument();
    expect(
      screen.getByText('Essa lição é de um plano pago.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));

    expect(screen.queryByText('Isso é do plano Plus')).not.toBeInTheDocument();
  });
});
