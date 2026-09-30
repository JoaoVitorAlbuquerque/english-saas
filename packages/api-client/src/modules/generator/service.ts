import { apiFetch } from '../../http/fetch-client';
import { answerResultSchema, type AnswerResult } from '../answers/schemas';
import {
  generateTopicRequestSchema,
  generationJobSchema,
  ingestRequestSchema,
  materialAnswerRequestSchema,
  materialDetailSchema,
  materialFeedbackRequestSchema,
  materialFeedbackSchema,
  materialsPageSchema,
  suggestTopicsRequestSchema,
  termReviewStateSchema,
  type GenerateTopicRequest,
  type GenerationJob,
  type IngestRequest,
  type MaterialAnswerRequest,
  type MaterialDetail,
  type MaterialFeedback,
  type MaterialFeedbackRequest,
  type MaterialsPage,
  type SuggestTopicsRequest,
  type TermReviewState,
} from './schemas';

export async function suggestTopics(
  input: SuggestTopicsRequest,
): Promise<GenerationJob> {
  return apiFetch('/generator/topic/suggest', {
    method: 'POST',
    body: suggestTopicsRequestSchema.parse(input),
    schema: generationJobSchema,
  });
}

export async function generateTopic(
  input: GenerateTopicRequest,
): Promise<GenerationJob> {
  return apiFetch('/generator/topic', {
    method: 'POST',
    body: generateTopicRequestSchema.parse(input),
    schema: generationJobSchema,
  });
}

export async function ingestContent(
  input: IngestRequest,
): Promise<GenerationJob> {
  return apiFetch('/generator/ingest', {
    method: 'POST',
    body: ingestRequestSchema.parse(input),
    schema: generationJobSchema,
  });
}

export async function getGenerationJob(id: string): Promise<GenerationJob> {
  return apiFetch(`/generator/jobs/${id}`, { schema: generationJobSchema });
}

export async function listMaterials(
  query: { cursor?: string; limit?: number } = {},
): Promise<MaterialsPage> {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const search = params.toString();

  return apiFetch(`/me/materials${search ? `?${search}` : ''}`, {
    schema: materialsPageSchema,
  });
}

export async function getMaterial(id: string): Promise<MaterialDetail> {
  return apiFetch(`/me/materials/${id}`, { schema: materialDetailSchema });
}

export async function answerMaterialItem(
  materialId: string,
  input: MaterialAnswerRequest,
): Promise<AnswerResult> {
  return apiFetch(`/me/materials/${materialId}/answers`, {
    method: 'POST',
    body: materialAnswerRequestSchema.parse(input),
    schema: answerResultSchema,
  });
}

export async function rateMaterial(
  materialId: string,
  input: MaterialFeedbackRequest,
): Promise<MaterialFeedback> {
  return apiFetch(`/me/materials/${materialId}/feedback`, {
    method: 'POST',
    body: materialFeedbackRequestSchema.parse(input),
    schema: materialFeedbackSchema,
  });
}

/** `termKey` é o termo normalizado que o próprio material devolve. */
export async function setTermInReview(
  materialId: string,
  termKey: string,
  inReview: boolean,
): Promise<TermReviewState> {
  return apiFetch(
    `/me/materials/${materialId}/vocabulary/${encodeURIComponent(termKey)}/review`,
    {
      method: inReview ? 'POST' : 'DELETE',
      schema: termReviewStateSchema,
    },
  );
}
