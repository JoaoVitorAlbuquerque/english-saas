import type { Story } from '@ladle/react';

import { Card } from './Card';

export const Basic: Story = () => (
  <Card className="max-w-sm">
    <h3 className="font-display text-lg text-ink">At the airport</h3>
    <p className="mt-1 text-sm text-muted">Unidade 3 · A2</p>
  </Card>
);
