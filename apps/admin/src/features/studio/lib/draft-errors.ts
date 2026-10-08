import { t } from '../../../messages/pt-BR';

/**
 * Por que um rascunho falhou, em português. O servidor só guarda o código; o
 * que cada código quer dizer, e o que dá para fazer, é daqui.
 */
export function describeDraftError(code: string | null): string {
  switch (code) {
    case 'DRAFT_REQUEST_INVALID':
      return t('studio.error.DRAFT_REQUEST_INVALID');
    case 'AI_VALIDATION_FAILED':
      return t('studio.error.AI_VALIDATION_FAILED');
    case 'AI_PROVIDER_UNAVAILABLE':
      return t('studio.error.AI_PROVIDER_UNAVAILABLE');
    case 'AI_INPUT_TOO_LARGE':
      return t('studio.error.AI_INPUT_TOO_LARGE');
    case null:
      return t('studio.error.unknown');
    default:
      return t('studio.error.other', { code });
  }
}
