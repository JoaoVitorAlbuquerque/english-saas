import { apiFetch } from '../../http/fetch-client';
import {
  correctionViewSchema,
  createCorrectionRequestSchema,
  roleplayTurnRequestSchema,
  roleplayViewSchema,
  startRoleplayRequestSchema,
  type CorrectionView,
  type CreateCorrectionRequest,
  type RoleplayTurnRequest,
  type RoleplayView,
  type StartRoleplayRequest,
} from './schemas';

export async function createCorrection(
  input: CreateCorrectionRequest,
): Promise<CorrectionView> {
  const body = createCorrectionRequestSchema.parse(input);

  return apiFetch('/tutor/corrections', {
    method: 'POST',
    body,
    schema: correctionViewSchema,
  });
}

export async function getCorrection(id: string): Promise<CorrectionView> {
  return apiFetch(`/tutor/corrections/${id}`, { schema: correctionViewSchema });
}

export async function startRoleplay(
  input: StartRoleplayRequest,
): Promise<RoleplayView> {
  const body = startRoleplayRequestSchema.parse(input);

  return apiFetch('/tutor/roleplays', {
    method: 'POST',
    body,
    schema: roleplayViewSchema,
  });
}

export async function getRoleplay(id: string): Promise<RoleplayView> {
  return apiFetch(`/tutor/roleplays/${id}`, { schema: roleplayViewSchema });
}

export async function submitRoleplayTurn(
  id: string,
  input: RoleplayTurnRequest,
): Promise<RoleplayView> {
  const body = roleplayTurnRequestSchema.parse(input);

  return apiFetch(`/tutor/roleplays/${id}/turns`, {
    method: 'POST',
    body,
    schema: roleplayViewSchema,
  });
}

export async function finishRoleplay(id: string): Promise<RoleplayView> {
  return apiFetch(`/tutor/roleplays/${id}/finish`, {
    method: 'POST',
    schema: roleplayViewSchema,
  });
}
