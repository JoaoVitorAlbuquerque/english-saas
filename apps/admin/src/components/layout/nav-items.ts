import {
  BarChart3,
  BookOpen,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Users,
} from 'lucide-react';

import { t } from '../../messages/pt-BR';

/**
 * `adminOnly`: a entrada some do menu do editor. Quem decide de verdade é a
 * API (`@Roles('ADMIN')`) e a `RoleGuard` da rota — o menu só poupa o clique.
 */
export const NAV_ITEMS = [
  {
    to: '/',
    label: t('nav.dashboard'),
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    to: '/conteudo',
    label: t('nav.content'),
    icon: BookOpen,
    adminOnly: false,
  },
  {
    to: '/estudio',
    label: t('nav.studio'),
    icon: Sparkles,
    adminOnly: false,
  },
  { to: '/alunos', label: t('nav.students'), icon: Users, adminOnly: true },
  {
    to: '/assinaturas',
    label: t('nav.subscriptions'),
    icon: CreditCard,
    adminOnly: true,
  },
  {
    to: '/metricas',
    label: t('nav.metrics'),
    icon: BarChart3,
    adminOnly: true,
  },
  {
    to: '/auditoria',
    label: t('nav.audit'),
    icon: ScrollText,
    adminOnly: true,
  },
] as const;
