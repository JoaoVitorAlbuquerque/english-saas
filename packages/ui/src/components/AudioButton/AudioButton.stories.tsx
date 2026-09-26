import type { Story } from '@ladle/react';

import { AudioButton } from './AudioButton';

export const Basic: Story = () => (
  <AudioButton src="/scene.mp3" label="Ouvir cena" />
);
