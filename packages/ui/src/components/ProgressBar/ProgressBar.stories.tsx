import type { Story } from '@ladle/react';

import { ProgressBar } from './ProgressBar';

export const Basic: Story = () => (
  <div className="max-w-sm">
    <ProgressBar value={3} max={5} label="3 de 5 etapas" />
  </div>
);
