import type { Story } from '@ladle/react';

import { Mark } from './Mark';

export const Basic: Story = () => (
  <p className="max-w-md text-base leading-relaxed text-ink">
    <Mark kind="REGISTER">I&apos;m gonna</Mark> head to the airport, so{' '}
    <Mark kind="CHUNK">catch you later</Mark>. Remember to use{' '}
    <Mark kind="GRAMMAR">the present continuous</Mark> for plans, and don&apos;t
    forget the <Mark kind="VOCAB">boarding pass</Mark>.
  </p>
);
