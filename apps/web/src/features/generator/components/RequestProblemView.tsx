import type { CreditsBalance } from '@english-saas/api-client';

import type { RequestProblem } from '../lib/use-generator-request';
import { CreditsNotice } from './CreditsNotice';

export function RequestProblemView({
  problem,
  credits,
  timeZone,
}: {
  problem: RequestProblem;
  credits: CreditsBalance | null;
  timeZone: string | undefined;
}) {
  if (problem === null) {
    return null;
  }

  if (problem.kind === 'insufficient-credits' && credits !== null) {
    return (
      <CreditsNotice
        credits={credits}
        cost={problem.cost}
        timeZone={timeZone}
      />
    );
  }

  return (
    <p role="alert" className="text-sm text-error">
      {problem.kind === 'message' ? problem.message : null}
    </p>
  );
}
