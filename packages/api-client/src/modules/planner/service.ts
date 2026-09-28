import { apiFetch } from '../../http/fetch-client';
import { studyPlanSchema, type StudyPlan } from './schemas';

export async function getPlan(): Promise<StudyPlan> {
  return apiFetch('/me/plan', { schema: studyPlanSchema });
}
