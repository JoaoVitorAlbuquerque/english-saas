import { apiFetch } from '../../http/fetch-client';
import {
  completeBlockRequestSchema,
  dailyAgendaSchema,
  forecastStatusSchema,
  rebuildPlanRequestSchema,
  skipBlockRequestSchema,
  studyPlanSchema,
  type CompleteBlockRequest,
  type DailyAgenda,
  type ForecastStatus,
  type RebuildPlanRequest,
  type SkipBlockRequest,
  type StudyPlan,
} from './schemas';

export async function getPlan(): Promise<StudyPlan> {
  return apiFetch('/me/plan', { schema: studyPlanSchema });
}

export async function rebuildPlan(
  input: RebuildPlanRequest = {},
): Promise<StudyPlan> {
  const body = rebuildPlanRequestSchema.parse(input);

  return apiFetch('/me/plan/rebuild', {
    method: 'POST',
    body,
    schema: studyPlanSchema,
  });
}

export async function getForecast(): Promise<ForecastStatus> {
  return apiFetch('/me/plan/forecast', { schema: forecastStatusSchema });
}

export async function getAgenda(): Promise<DailyAgenda> {
  return apiFetch('/me/agenda', { schema: dailyAgendaSchema });
}

export async function skipAgendaBlock(
  blockId: string,
  input: SkipBlockRequest = {},
): Promise<DailyAgenda> {
  const body = skipBlockRequestSchema.parse(input);

  return apiFetch(`/me/agenda/blocks/${blockId}/skip`, {
    method: 'POST',
    body,
    schema: dailyAgendaSchema,
  });
}

export async function completeAgendaBlock(
  blockId: string,
  input: CompleteBlockRequest = {},
): Promise<DailyAgenda> {
  const body = completeBlockRequestSchema.parse(input);

  return apiFetch(`/me/agenda/blocks/${blockId}/complete`, {
    method: 'POST',
    body,
    schema: dailyAgendaSchema,
  });
}
