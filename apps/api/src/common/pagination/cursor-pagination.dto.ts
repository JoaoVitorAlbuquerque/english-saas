import { cursorPaginationQuerySchema } from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';

/**
 * Query padrão de toda listagem. Use como `@Query()` no controller:
 *
 *   list(@Query() query: CursorPaginationQueryDto)
 */
export class CursorPaginationQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}
