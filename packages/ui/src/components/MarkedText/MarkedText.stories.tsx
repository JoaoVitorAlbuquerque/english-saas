import type { Story } from '@ladle/react';
import type { Span } from '@english-saas/shared';

import { MarkedText } from './MarkedText';

const TEXT = "He's gonna call you later.";

const SPANS: Span[] = [
  { start: 5, end: 10, kind: 'REGISTER', registerNoteId: 'gonna' },
  { start: 20, end: 25, kind: 'VOCAB', skillId: 'vocab.time-expressions' },
];

export const Basic: Story = () => (
  <div className="max-w-md text-base leading-relaxed text-ink">
    <MarkedText text={TEXT} spans={SPANS} />
  </div>
);

export const SemMarcacao: Story = () => (
  <div className="max-w-md text-base leading-relaxed text-ink">
    <MarkedText text={TEXT} spans={[]} />
  </div>
);
