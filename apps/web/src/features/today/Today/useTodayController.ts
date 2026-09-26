import { t } from '../../../messages/pt-BR';

/** Ainda não há dados reais — o módulo planner entra no front-end à parte. */
export function useTodayController() {
  return {
    title: t('placeholder.today.title'),
    description: t('placeholder.today.description'),
  };
}
