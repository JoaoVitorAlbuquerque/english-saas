import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'IS_PUBLIC';

/** Libera a rota do guard de autenticação global. */
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);
