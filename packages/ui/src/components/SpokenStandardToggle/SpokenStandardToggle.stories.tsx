import type { Story } from '@ladle/react';

import { SpokenStandardToggle } from './SpokenStandardToggle';

export const Basic: Story = () => (
  <SpokenStandardToggle
    spoken="I'm gonna call you."
    standard="I am going to call you."
  />
);
