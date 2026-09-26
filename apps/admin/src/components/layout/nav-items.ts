import {
  BarChart3,
  BookOpen,
  CreditCard,
  LayoutDashboard,
  Users,
} from 'lucide-react';

import { t } from '../../messages/pt-BR';

export const NAV_ITEMS = [
  {
    to: '/',
    label: t('nav.dashboard'),
    icon: LayoutDashboard,
    disabled: false,
  },
  { to: '/conteudo', label: t('nav.content'), icon: BookOpen, disabled: true },
  { to: '/alunos', label: t('nav.students'), icon: Users, disabled: true },
  {
    to: '/assinaturas',
    label: t('nav.subscriptions'),
    icon: CreditCard,
    disabled: true,
  },
  { to: '/metricas', label: t('nav.metrics'), icon: BarChart3, disabled: true },
] as const;
