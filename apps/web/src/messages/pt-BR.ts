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
  'auth.login.forgotPassword': 'Esqueci minha senha',
  'auth.login.noAccount': 'Ainda não tem conta?',
  'auth.login.createAccount': 'Criar conta',
  'auth.login.googleButton': 'Entrar com Google',
  'auth.login.or': 'ou',

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
  'auth.signup.goToLogin': 'Ir para o login',

  'passwordStrength.label': 'Força da senha',
  'passwordStrength.0': 'Muito fraca',
  'passwordStrength.1': 'Fraca',
  'passwordStrength.2': 'Razoável',
  'passwordStrength.3': 'Boa',
  'passwordStrength.4': 'Forte',

  'auth.forgotPassword.title': 'Esqueceu sua senha?',
  'auth.forgotPassword.subtitle':
    'Informe seu e-mail e mandamos um link para você escolher uma nova.',
  'auth.forgotPassword.email': 'E-mail',
  'auth.forgotPassword.submit': 'Enviar link',
  'auth.forgotPassword.backToLogin': 'Voltar para o login',
  'auth.forgotPassword.sentTitle': 'Verifique seu e-mail',
  'auth.forgotPassword.sentDescription':
    'Se existir uma conta com esse e-mail, você vai receber um link para redefinir a senha.',

  'auth.resetPassword.title': 'Escolha uma nova senha',
  'auth.resetPassword.password': 'Nova senha',
  'auth.resetPassword.confirmPassword': 'Confirme a nova senha',
  'auth.resetPassword.passwordMismatch': 'As senhas não são iguais.',
  'auth.resetPassword.submit': 'Redefinir senha',
  'auth.resetPassword.invalidLinkTitle': 'Este link não é válido',
  'auth.resetPassword.invalidLinkDescription':
    'Peça um novo link de redefinição de senha.',
  'auth.resetPassword.requestNewLink': 'Pedir novo link',
  'auth.resetPassword.successToast':
    'Senha redefinida. Entre com a senha nova.',

  'auth.verifyEmail.loading': 'Confirmando seu e-mail…',
  'auth.verifyEmail.successTitle': 'E-mail confirmado!',
  'auth.verifyEmail.successDescription':
    'Sua conta está com o e-mail verificado.',
  'auth.verifyEmail.continue': 'Continuar',
  'auth.verifyEmail.errorTitle': 'Não foi possível confirmar',
  'auth.verifyEmail.resendEmail': 'Digite seu e-mail para receber um link novo',
  'auth.verifyEmail.resendSubmit': 'Reenviar confirmação',
  'auth.verifyEmail.resendSuccess': 'Reenviado! Confira sua caixa de entrada.',

  'auth.google.loading': 'Concluindo login com o Google…',
  'auth.google.deniedTitle': 'Login com o Google não foi concluído',
  'auth.google.deniedDescription':
    'Você pode tentar de novo ou entrar com e-mail e senha.',
  'auth.google.backToLogin': 'Voltar para o login',

  'onboarding.step.goal.title': 'O que te trouxe até aqui?',
  'onboarding.step.goal.description': 'Escolha um ou mais objetivos.',
  'onboarding.step.goal.noteLabel': 'Conte um pouco mais',
  'onboarding.step.goal.noteError': 'Escolha pelo menos um objetivo.',

  'onboarding.step.availability.title': 'Quanto tempo você tem?',
  'onboarding.step.availability.description':
    'Minutos por dia da semana — dá para mudar depois.',
  'onboarding.step.availability.shortcutDaily': '10 min todo dia',
  'onboarding.step.availability.shortcutWeekdays': '20 min em dias úteis',
  'onboarding.step.availability.preferredTime': 'Melhor horário para estudar',
  'onboarding.step.availability.zeroHint':
    'Escolha pelo menos alguns minutos para montarmos sua agenda.',
  'onboarding.step.availability.minutesLabel': 'min',

  'onboarding.step.interests.title': 'O que você gosta?',
  'onboarding.step.interests.description':
    'Vamos usar isso para trazer temas que interessam a você.',
  'onboarding.step.interests.search': 'Buscar um tema',
  'onboarding.step.interests.selected': 'Selecionados',
  'onboarding.step.interests.suggestions': 'Sugestões',
  'onboarding.step.interests.addCustom': 'Adicionar',
  'onboarding.step.interests.empty': 'Nenhum tema encontrado.',

  'onboarding.step.level.title': 'Como está seu inglês hoje?',
  'onboarding.step.level.description':
    'Isso ajuda a calibrar o começo — nada é definitivo.',
  'onboarding.step.level.NONE.title': 'Iniciante total',
  'onboarding.step.level.BASIC.title': 'Básico',
  'onboarding.step.level.INTERMEDIATE.title': 'Intermediário',
  'onboarding.step.level.ADVANCED.title': 'Avançado',

  'onboarding.step.consents.title': 'Só mais uma coisa',
  'onboarding.step.consents.description':
    'Precisamos do seu ok para personalizar o que você estuda.',
  'onboarding.step.consents.personalization':
    'Quero que meu estudo seja personalizado com base no meu progresso e nos meus interesses.',
  'onboarding.step.consents.personalizationRequired':
    'Esse aceite é necessário para usar a plataforma.',
  'onboarding.step.consents.marketing':
    'Quero receber novidades e ofertas por e-mail.',
  'onboarding.step.consents.submit': 'Concluir',
  'onboarding.step.consents.error':
    'Não conseguimos salvar suas respostas. Tente de novo.',

  'onboarding.continue': 'Continuar',

  'onboarding.finish.title': 'Tudo pronto!',
  'onboarding.finish.descriptionNone':
    'Como você nunca estudou, você pode começar direto no nível A1 ou fazer um nivelamento rápido para a gente calibrar melhor.',
  'onboarding.finish.descriptionOther':
    'Vamos fazer um nivelamento rápido para calibrar o seu ponto de partida.',
  'onboarding.finish.startAtA1': 'Começar no nível A1',
  'onboarding.finish.goToPlacement': 'Fazer o nivelamento',

  'placement.title': 'Nivelamento em construção',
  'placement.description':
    'Esta é a prova adaptativa que descobre seu nível em cada competência. Ainda não está pronta nesta versão do app.',
  'placement.skipForNow': 'Ir para Hoje por enquanto',

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
  'error.network.retry': 'Tentar de novo',
} as const;

type MessageKey = keyof typeof messages;

export function t(key: MessageKey): string {
  return messages[key];
}
