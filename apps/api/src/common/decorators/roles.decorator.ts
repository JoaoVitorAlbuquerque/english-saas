import { SetMetadata } from '@nestjs/common';
import type { Role } from '@english-saas/shared';

export const ROLES_KEY = 'ROLES';

/**
 * Restringe a rota a determinados papéis.
 *
 *   @Roles('ADMIN', 'EDITOR')
 *   @Post('lessons')
 *
 * Sem o decorator, qualquer usuário autenticado passa.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
