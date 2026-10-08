/**
 * Contratos compartilhados entre a API e o front-end.
 *
 * Regra: aqui entram apenas tipos, enums e schemas zod. Nada de regra de
 * negócio (isso mora em `domain/` de cada módulo da API) e nada de
 * dependência de runtime além do zod.
 */
export * from './cefr';
export * from './competency';
export * from './user';
export * from './curriculum';
export * from './wordlists';
export * from './lesson-content';
export * from './lesson-validation';
export * from './lesson-authoring';
export * from './item-content';
export * from './answer-normalization';
export * from './student-view';
export * from './item-validation';
export * from './draft-authoring';
export * from './item-authoring';
export * from './taxonomy-authoring';
export * from './learning';
export * from './pagination';
export * from './api-error';
export * from './health';
