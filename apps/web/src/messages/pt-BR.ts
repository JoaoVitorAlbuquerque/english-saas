/**
 * Textos da interface em pt-BR. Um dicionário plano por enquanto — se um dia
 * precisarmos de outro idioma, é só trocar o objeto que `t()` lê, sem tocar
 * nos componentes.
 */
export const messages = {
  'nav.today': 'Hoje',
  'nav.catalog': 'Catálogo',
  'nav.progress': 'Progresso',
  'nav.profile': 'Perfil',

  'auth.login.title': 'Entre na sua conta',
  'auth.login.subtitle': 'Continue de onde parou.',
  'auth.login.email': 'E-mail',
  'auth.login.password': 'Senha',
  'auth.login.submit': 'Entrar',
  'auth.login.noAccount': 'Ainda não tem conta?',
  'auth.login.createAccount': 'Criar conta',
  'auth.login.googleSoon': 'Entrar com Google (em breve)',
  'auth.login.genericError':
    'Não foi possível entrar. Confira seus dados e tente de novo.',

  'auth.signup.title': 'Crie sua conta',
  'auth.signup.subtitle': 'Leva menos de um minuto.',
  'auth.signup.name': 'Nome',
  'auth.signup.email': 'E-mail',
  'auth.signup.password': 'Senha',
  'auth.signup.acceptedTerms': 'Li e aceito os termos de uso.',
  'auth.signup.acceptedPrivacyPolicy': 'Li e aceito a política de privacidade.',
  'auth.signup.submit': 'Criar conta',
  'auth.signup.hasAccount': 'Já tem conta?',
  'auth.signup.login': 'Entrar',

  'placeholder.today.title': 'Sua lição de hoje ainda não chegou aqui',
  'placeholder.today.description':
    'Esta tela vai mostrar a agenda do dia assim que o módulo de cronograma entrar no front-end.',
  'placeholder.catalog.title': 'Catálogo em construção',
  'placeholder.catalog.description':
    'Aqui vão aparecer as unidades e apostilas de cada nível.',
  'placeholder.progress.title': 'Seu progresso em construção',
  'placeholder.progress.description':
    'Aqui vão aparecer sequência, XP e evolução por competência.',
  'placeholder.profile.title': 'Perfil em construção',
  'placeholder.profile.description':
    'Aqui vão aparecer seus dados e preferências.',

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
