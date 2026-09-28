export const messages = {
  'nav.dashboard': 'Painel',
  'nav.content': 'Conteúdo',
  'nav.students': 'Alunos',
  'nav.subscriptions': 'Assinaturas',
  'nav.metrics': 'Métricas',
  'nav.comingSoon': 'em breve',

  'auth.login.title': 'Entrar no painel',
  'auth.login.subtitle': 'Acesso restrito a editores e administradores.',
  'auth.login.email': 'E-mail',
  'auth.login.password': 'Senha',
  'auth.login.submit': 'Entrar',

  'forbidden.title': 'Sem acesso a este painel',
  'forbidden.description':
    'Sua conta não tem permissão de editor ou administrador. Fale com o time se isso for um engano.',
  'forbidden.backToLogin': 'Voltar para o login',

  'dashboard.title': 'Painel em construção',
  'dashboard.description':
    'As telas de conteúdo, alunos, assinaturas e métricas entram como módulos à parte.',

  'notFound.title': 'Página não encontrada',
  'notFound.description': 'O endereço que você tentou acessar não existe.',
  'notFound.backHome': 'Voltar para o início',

  'error.boundary.title': 'Algo deu errado nesta tela',
  'error.boundary.description': 'Tente recarregar a página.',
} as const;

type MessageKey = keyof typeof messages;

export function t(key: MessageKey): string {
  return messages[key];
}
