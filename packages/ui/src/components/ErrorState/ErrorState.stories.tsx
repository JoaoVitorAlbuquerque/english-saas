import type { Story } from '@ladle/react';

import { ErrorState } from './ErrorState';

export const Basic: Story = () => (
  <ErrorState
    title="Não conseguimos carregar sua lição"
    description="Verifique sua conexão e tente de novo."
    onRetry={() => {}}
  />
);
