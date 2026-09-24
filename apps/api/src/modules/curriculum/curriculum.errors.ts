import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/**
 * Erros do módulo. `code` em inglês, `message` em pt-BR pronto para exibir
 * ao editor — quem vê essas mensagens é gente do time de conteúdo.
 */

/** O conteúdo não passou pelo schema da etapa ou da questão. */
export class ContentValidationError extends AppException {
  constructor(details: unknown) {
    super(
      'CONTENT_VALIDATION_FAILED',
      'O conteúdo tem problemas que precisam ser corrigidos antes de salvar.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

/** O conteúdo aponta para skill, item, personagem ou asset que não existe. */
export class MissingReferencesError extends AppException {
  constructor(details: unknown) {
    super(
      'MISSING_REFERENCES',
      'O conteúdo aponta para coisas que não existem ou não estão publicadas.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

/**
 * Ação e status viajam em inglês no `details` — é o identificador estável
 * que o cliente usa. Na `message`, que o editor lê, eles aparecem em pt-BR.
 */
const ACTION_LABELS: Record<string, string> = {
  submit: 'mandar para revisão',
  approve: 'aprovar',
  reject: 'devolver para rascunho',
  publish: 'publicar',
  archive: 'arquivar',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'rascunho',
  IN_REVIEW: 'revisão',
  APPROVED: 'aprovado',
  PUBLISHED: 'publicado',
  ARCHIVED: 'arquivado',
};

/** A ação não vale no estado atual (aprovar um rascunho, por exemplo). */
export class InvalidTransitionError extends AppException {
  constructor(current: string, action: string) {
    super(
      'INVALID_CONTENT_TRANSITION',
      `Não dá para ${ACTION_LABELS[action] ?? action} um conteúdo que está em ${
        STATUS_LABELS[current] ?? current
      }.`,
      HttpStatus.CONFLICT,
      { current, action },
    );
  }
}

/** Já existe uma versão aberta — não abrimos duas em paralelo. */
export class DraftAlreadyOpenError extends AppException {
  constructor(version: number) {
    super(
      'DRAFT_ALREADY_OPEN',
      `A versão ${String(version)} ainda está aberta. Publique ou arquive ela antes de começar outra.`,
      HttpStatus.CONFLICT,
      { version },
    );
  }
}

/** Tentou mexer no enunciado de um item que já foi respondido. */
export class ItemIsImmutableError extends AppException {
  constructor(fields: readonly string[]) {
    super(
      'ITEM_IS_IMMUTABLE',
      'Este item já foi publicado. Para mudar o enunciado, crie uma nova versão dele.',
      HttpStatus.CONFLICT,
      { fields },
    );
  }
}

/** Tentou arquivar um item que está preso a uma lição no ar. */
export class ItemInUseError extends AppException {
  constructor(lessonSlugs: readonly string[]) {
    super(
      'ITEM_IN_USE',
      'Este item está sendo usado por uma lição publicada e não pode ser arquivado.',
      HttpStatus.CONFLICT,
      { lessons: lessonSlugs },
    );
  }
}

export class SlugInUseError extends AppException {
  constructor(slug: string) {
    super(
      'SLUG_IN_USE',
      `Já existe conteúdo com o identificador "${slug}".`,
      HttpStatus.CONFLICT,
      { slug },
    );
  }
}

/** Slug de taxonomia não se renomeia — deprecia e substitui. */
export class TaxonomySlugIsImmutableError extends AppException {
  constructor(id: string) {
    super(
      'TAXONOMY_SLUG_IS_IMMUTABLE',
      `O identificador "${id}" não pode mudar. Marque como descontinuado e aponte o substituto.`,
      HttpStatus.CONFLICT,
      { id },
    );
  }
}
