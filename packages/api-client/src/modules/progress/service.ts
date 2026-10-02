import { apiFetch } from '../../http/fetch-client';
import {
  PROGRESS_WEEKS_DEFAULT,
  studentProgressSchema,
  type StudentProgress,
} from './schemas';

export async function getProgress(
  weeks: number = PROGRESS_WEEKS_DEFAULT,
): Promise<StudentProgress> {
  return apiFetch(`/me/progress?weeks=${String(weeks)}`, {
    schema: studentProgressSchema,
  });
}
