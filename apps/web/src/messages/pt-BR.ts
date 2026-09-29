/**
 * Textos da interface em pt-BR. Um dicionário plano por enquanto — se um dia
 * precisarmos de outro idioma, é só trocar o objeto que `t()` lê, sem tocar
 * nos componentes.
 */
export const messages = {
  'nav.today': 'Hoje',
  'nav.review': 'Revisão',
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

  'placement.intro.title': 'Vamos descobrir seu nível',
  'placement.intro.description':
    'São 12 a 30 perguntas, dependendo das suas respostas — o teste se ajusta ao longo do caminho. Leva até 30 minutos.',
  'placement.intro.dontKnowHint':
    'Não sabe a resposta? Toque em "Não sei" em vez de chutar — isso ajuda a medir seu nível com mais precisão.',
  'placement.intro.begin': 'Começar',

  'placement.question.dontKnow': 'Não sei',

  'placement.result.title': 'Seu nível',
  'placement.result.canDoTitle': 'O que você já consegue fazer',
  'placement.result.goToToday': 'Ver meu plano',
  'placement.result.retake': 'Refazer o nivelamento',
  'placement.result.retakeAvailableFrom': 'Você poderá refazer a partir de',

  'placement.error.loadTitle': 'Não conseguimos carregar o nivelamento',
  'placement.error.retry': 'Tentar de novo',

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

  'lesson.loading': 'Carregando a lição…',
  'lesson.error.loadTitle': 'Não conseguimos carregar esta lição',
  'lesson.common.continue': 'Continuar',
  'lesson.common.send': 'Enviar',
  'lesson.rubric.met': 'Cumpriu',
  'lesson.rubric.notMet': 'Não cumpriu',

  'lesson.topBar.exit': 'Sair da lição',

  'lesson.exit.title': 'Sair da lição?',
  'lesson.exit.description': 'Você continua de onde parou na próxima vez.',
  'lesson.exit.stay': 'Continuar na lição',
  'lesson.exit.confirm': 'Sair',

  'lesson.scene.playAll': 'Ouvir a cena inteira',
  'lesson.scene.playLine': 'Ouvir',
  'lesson.scene.showTranslation': 'Ver tradução',
  'lesson.scene.hideTranslation': 'Esconder tradução',

  'lesson.cards.previous': 'Card anterior',
  'lesson.cards.next': 'Próximo card',
  'lesson.cards.nextButton': 'Próximo',

  'lesson.production.submit': 'Enviar',
  'lesson.production.responseLabel': 'Sua resposta',
  'lesson.production.correcting': 'Corrigindo a sua resposta…',
  'lesson.production.insufficientCredits':
    'Você não tem créditos de IA agora. Sua resposta foi salva, mas não deu para corrigir desta vez.',
  'lesson.production.noErrors': 'Nenhum erro encontrado.',
  'lesson.production.correctedVersion': 'Versão corrigida',

  'lesson.roleplay.preparing': 'Preparando a conversa…',
  'lesson.roleplay.helpPrefix': 'Ajuda',
  'lesson.roleplay.placeholder': 'Escreva sua resposta',
  'lesson.roleplay.finish': 'Encerrar conversa',
  'lesson.roleplay.summaryTitle': 'Como foi a conversa',

  'lesson.summary.takeawaysTitle': 'O que você aprendeu',
  'lesson.summary.finish': 'Concluir lição',
  'lesson.summary.accuracySuffix': '% de acerto',
  'lesson.summary.reviewNote':
    'O que você praticou aqui entra na sua revisão espaçada nos próximos dias.',
  'lesson.summary.nextLessonLabel': 'Próxima lição do seu plano',
  'lesson.summary.startNextLesson': 'Fazer agora',
  'lesson.summary.goToPlan': 'Ver meu plano',
  'lesson.summary.retake': 'Refazer',

  'today.greeting.morning': 'Bom dia!',
  'today.greeting.afternoon': 'Boa tarde!',
  'today.greeting.evening': 'Boa noite!',
  'today.error.loadTitle': 'Não conseguimos carregar sua agenda',
  'today.emptyPlan.title': 'Seu plano está quase pronto',
  'today.emptyPlan.description':
    'Isso leva só alguns segundos depois do cadastro.',
  'today.emptyPlan.retry': 'Tentar de novo',
  'today.noBlocks.title': 'Nada agendado pra hoje',
  'today.noBlocks.description':
    'Sem tempo disponível hoje no seu perfil — ajuste em Perfil se isso não estiver certo.',
  'today.allDone.title': 'Tudo em dia por hoje',
  'today.allDone.description': 'Volte amanhã pra continuar de onde parou.',
  'today.startButton': 'Começar',
  'today.block.review.title': 'Revisão',
  'today.block.lesson.defaultTitle': 'Lição',
  'today.block.practice.title': 'Prática',
  'today.block.skip': 'Pular',
  'today.block.statusDone': 'Feito',
  'today.block.statusSkipped': 'Pulado',
  'today.skipDialog.title': 'Por que pular?',
  'today.skipDialog.reason.NO_TIME': 'Sem tempo agora',
  'today.skipDialog.reason.ALREADY_KNOW': 'Já sei isso',
  'today.skipDialog.reason.TOO_HARD': 'Está difícil demais',
  'today.skipDialog.reason.OTHER': 'Outro motivo',
  'today.skipDialog.notePlaceholder': 'Conte um pouco mais (opcional)',
  'today.skipDialog.confirm': 'Pular bloco',
  'today.skipDialog.cancel': 'Cancelar',
  'today.pace.rebuildButton': 'Refazer plano',
  'today.rebuildConfirm.title': 'Refazer seu plano?',
  'today.rebuildConfirm.description':
    'Vamos remontar sua trilha com base no que você já sabe hoje. A agenda de hoje não muda — só as próximas lições.',
  'today.rebuildConfirm.confirm': 'Refazer plano',
  'today.rebuildConfirm.cancel': 'Cancelar',
  'today.rebuildConfirm.success': 'Plano atualizado.',
  'today.practiceModal.title': 'Prática rápida',
  'today.practiceModal.continue': 'Continuar',

  'review.title': 'Revisão',
  'review.pickMinutes.title': 'Quanto tempo você tem agora?',
  'review.pickMinutes.start': 'Começar',
  'review.empty.title': 'Nada pra revisar agora',
  'review.empty.description':
    'Volte mais tarde ou continue estudando lições novas.',
  'review.error.loadTitle': 'Não conseguimos carregar sua revisão',
  'review.exit': 'Sair',
  'review.exitConfirm.title': 'Sair da revisão?',
  'review.exitConfirm.description':
    'O que você já revisou continua salvo. Você pode voltar depois.',
  'review.exitConfirm.stay': 'Continuar revisando',
  'review.exitConfirm.confirm': 'Sair',
  'review.flashcard.flip': 'Virar',
  'review.flashcard.again': 'Errei',
  'review.flashcard.hard': 'Difícil',
  'review.flashcard.good': 'Acertei',
  'review.flashcard.easy': 'Fácil',
  'review.continue': 'Continuar',
  'review.summary.title': 'Sessão concluída',
  'review.summary.dueGroupTitle': 'Quando eles voltam',
  'review.summary.dueToday': 'Ainda hoje',
  'review.summary.dueTomorrow': 'Amanhã',
  'review.summary.noneDue': 'Nenhum card vencido agora.',
  'review.summary.restart': 'Revisar mais',
  'review.summary.finish': 'Voltar para Hoje',

  'paywall.titlePrefix': 'Isso é do plano',
  'paywall.titleGeneric': 'Isso é de um plano pago',
  'paywall.dismiss': 'Entendi',
} as const;

type MessageKey = keyof typeof messages;

export function t(key: MessageKey): string {
  return messages[key];
}
