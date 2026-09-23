/**
 * Contratos compartilhados entre a API e o front-end.
 *
 * Regra: aqui entram apenas tipos, enums e schemas zod. Nada de regra de
 * negócio (isso mora em `domain/` de cada módulo da API) e nada de
 * dependência de runtime além do zod.
 */
export * from './cefr';
export * from './competency';
export * from './pagination';
export * from './api-error';
export * from './health';
