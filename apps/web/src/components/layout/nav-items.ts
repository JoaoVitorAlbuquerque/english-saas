import { BookOpen, RotateCcw, Sunrise, TrendingUp, User } from 'lucide-react';

import { t } from '../../messages/pt-BR';

export const NAV_ITEMS = [
  { to: '/hoje', label: t('nav.today'), icon: Sunrise },
  { to: '/revisao', label: t('nav.review'), icon: RotateCcw },
  { to: '/catalogo', label: t('nav.catalog'), icon: BookOpen },
  { to: '/progresso', label: t('nav.progress'), icon: TrendingUp },
  { to: '/perfil', label: t('nav.profile'), icon: User },
] as const;
