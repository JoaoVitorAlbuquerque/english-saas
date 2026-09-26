import type { Story } from '@ladle/react';

import { CharacterAvatar } from './CharacterAvatar';

export const Basic: Story = () => (
  <div className="flex items-center gap-3">
    <CharacterAvatar name="Maya" tone="maya" />
    <CharacterAvatar name="Lucas" tone="lucas" />
    <CharacterAvatar name="Aluno" tone="neutral" size="sm" />
  </div>
);
