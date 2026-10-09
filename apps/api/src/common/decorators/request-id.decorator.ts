import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Id do request (pino-http); o mesmo que volta no header `x-request-id`. */
export const RequestId = createParamDecorator<undefined>(
  (_data, context: ExecutionContext): string | undefined => {
    const id = context.switchToHttp().getRequest<Request>().id;

    return typeof id === 'string' ? id : undefined;
  },
);
