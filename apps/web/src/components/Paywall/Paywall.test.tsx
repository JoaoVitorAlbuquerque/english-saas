import { ApiError, emitApiClientEvent } from '@english-saas/api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Paywall } from './Paywall';

function renderPaywall() {
  return render(
    <MemoryRouter initialEntries={['/hoje']}>
      <Paywall />
      <Routes>
        <Route path="/hoje" element={<p>Hoje</p>} />
        <Route path="/planos" element={<p>Planos</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Paywall', () => {
  it('abre quando o evento plan-required chega, com a mensagem e o plano', async () => {
    renderPaywall();

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

  it('"Ver planos" leva pra /planos e fecha o diálogo', async () => {
    renderPaywall();

    emitApiClientEvent({
      type: 'plan-required',
      requiredPlan: 'BASE',
      error: new ApiError({
        code: 'PLAN_REQUIRED',
        message: 'Essa apostila é de um plano pago.',
        status: 403,
      }),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver planos' }),
    );

    expect(await screen.findByText('Planos')).toBeInTheDocument();
    expect(screen.queryByText('Isso é do plano Base')).not.toBeInTheDocument();
  });
});
