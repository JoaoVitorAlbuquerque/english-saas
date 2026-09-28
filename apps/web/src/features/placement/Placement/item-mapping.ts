import type { PlacementItem } from '@english-saas/api-client';
import { toItemView as toItemViewShared } from '@english-saas/ui';
import type { ItemView } from '@english-saas/ui';

/**
 * `toItemView` genérico (`@english-saas/ui`) recebe o mapa de assets à
 * parte — aqui ele vem embutido no próprio item do nivelamento.
 */
export function toItemView(item: PlacementItem): ItemView {
  return toItemViewShared(item, item.assets);
}
