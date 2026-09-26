import type { Story } from '@ladle/react';

import { StepDots } from './StepDots';

export const Basic: Story = () => <StepDots total={5} current={2} />;
