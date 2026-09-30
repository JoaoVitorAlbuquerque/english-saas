import {
  BookOpen,
  RotateCcw,
  Sparkles,
  Sunrise,
  TrendingUp,
  User,
} from 'lucide-react';

import { t } from '../../messages/pt-BR';

/**
 * `mobile: false` fica só na barra lateral do desktop — a barra do celular
 * tem 5 itens no máximo. No celular, as ferramentas do Plus abrem pelo
 * cartão da tela Hoje e pelo atalho do Catálogo.
 */
export const NAV_ITEMS = [
  { to: '/hoje', label: t('nav.today'), icon: Sunrise, mobile: true },
  { to: '/revisao', label: t('nav.review'), icon: RotateCcw, mobile: true },
  { to: '/catalogo', label: t('nav.catalog'), icon: BookOpen, mobile: true },
  { to: '/ferramentas', label: t('nav.tools'), icon: Sparkles, mobile: false },
  {
    to: '/progresso',
    label: t('nav.progress'),
    icon: TrendingUp,
    mobile: true,
  },
  { to: '/perfil', label: t('nav.profile'), icon: User, mobile: true },
] as const;

export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.mobile);
