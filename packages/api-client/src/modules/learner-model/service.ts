import { apiFetch } from '../../http/fetch-client';
import { learnerProfileSchema, type LearnerProfile } from './schemas';

export async function getLearnerProfile(): Promise<LearnerProfile> {
  return apiFetch('/me/learner-profile', { schema: learnerProfileSchema });
}
