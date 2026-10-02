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
  'nav.tools': 'Ferramentas',

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

  'catalog.title': 'Catálogo',
  'catalog.searchPlaceholder': 'Buscar por título ou assunto',
  'catalog.allLevels': 'Todos',
  'catalog.locked': 'Bloqueada',
  'catalog.errorTitle': 'Não conseguimos carregar o catálogo',
  'catalog.emptyTitle': 'Ainda não temos unidades publicadas',
  'catalog.emptyDescription': 'Volte em breve — o conteúdo está a caminho.',
  'catalog.noMatchTitle': 'Nada encontrado',
  'catalog.noMatchDescription': 'Tenta outro termo ou outro nível.',

  'unit.errorTitle': 'Não conseguimos carregar esta unidade',
  'unit.cast': 'Elenco',
  'unit.lessons': 'Lições',
  'unit.noLessonsTitle': 'Ainda não tem lição publicada aqui',
  'unit.noLessonsDescription': 'Volte em breve — o conteúdo está a caminho.',
  'unit.lesson.inPlan': 'No meu plano',
  'unit.lesson.completed': 'Concluída',
  'unit.lesson.inProgress': 'Em andamento',
  'unit.checkpoint.title': 'Checkpoint da unidade',
  'unit.checkpoint.subtitle':
    'Um diagnóstico rápido do que já firmou — nunca trava, pode refazer quando quiser.',
  'unit.checkpoint.action': 'Fazer checkpoint',
  'unit.workbook.subtitle': 'Apostila em PDF desta unidade',
  'unit.workbook.action': 'Baixar',

  'checkpoint.intro.title': 'Checkpoint da unidade',
  'checkpoint.intro.description':
    'Algumas perguntas sobre o que esta unidade ensina, pra ver o que já firmou e o que vale reforçar. É diagnóstico — não trava nada.',
  'checkpoint.intro.cancel': 'Agora não',
  'checkpoint.intro.start': 'Começar',
  'checkpoint.progress': 'Pergunta',
  'checkpoint.result.title': 'Resultado do checkpoint',
  'checkpoint.result.reinforceTitle': 'Vale reforçar',
  'checkpoint.result.close': 'Fechar',

  'auth.login.accountDeletedTitle': 'Sua conta foi excluída',
  'auth.login.accountDeleted':
    'Ela saiu do ar agora. Seus dados pessoais serão anonimizados em {days} dias, até {date}.',

  'interests.full':
    'Você chegou ao limite de {max} temas. Tire um para pôr outro.',

  'profile.title': 'Perfil',
  'profile.back': 'Voltar ao perfil',
  'profile.errorTitle': 'Não conseguimos carregar seu perfil',
  'profile.cancel': 'Cancelar',

  'profile.account.title': 'Seus dados',
  'profile.account.name': 'Nome',
  'profile.account.nameInvalid': 'Escreva um nome com pelo menos 2 letras.',
  'profile.account.email': 'E-mail',
  'profile.account.emailHint':
    'O e-mail não pode ser alterado por aqui por enquanto.',
  'profile.account.emailVerified': 'E-mail confirmado',
  'profile.account.emailUnverified': 'E-mail ainda não confirmado',
  'profile.account.timezone': 'Fuso horário',
  'profile.account.timezoneHint':
    'Define quando o seu dia começa e a hora dos lembretes. Se mudar, recalculamos o plano.',
  'profile.account.save': 'Salvar alterações',
  'profile.account.saved': 'Dados salvos',
  'profile.account.saveError': 'Não conseguimos salvar agora. Tente de novo.',

  'profile.links.title': 'Configurações',
  'profile.links.study': 'Estudo',
  'profile.links.studyDescription':
    'Objetivos, tempo disponível, nível-alvo e interesses',
  'profile.links.notifications': 'Notificações',
  'profile.links.notificationsDescription':
    'Lembretes por e-mail e no navegador',
  'profile.links.privacy': 'Privacidade e conta',
  'profile.links.privacyDescription':
    'Consentimentos, seus dados e exclusão da conta',
  'profile.links.subscriptionDescription': 'Plano, pagamento e créditos de IA',

  'profile.session.title': 'Sessão',
  'profile.session.logout': 'Sair',
  'profile.session.logoutAll': 'Sair de todos os dispositivos',
  'profile.session.logoutAllTitle': 'Sair de todos os dispositivos?',
  'profile.session.logoutAllDescription':
    'Vamos encerrar a sessão em todos os aparelhos onde você entrou, inclusive neste. Você vai precisar entrar de novo.',
  'profile.session.logoutAllConfirm': 'Sair de todos',
  'profile.session.logoutError':
    'Não conseguimos encerrar a sessão agora. Confira a conexão e tente de novo.',

  'profile.study.title': 'Estudo',
  'profile.study.errorTitle':
    'Não conseguimos carregar suas configurações de estudo',
  'profile.study.goalsTitle': 'Seus objetivos',
  'profile.study.goalsEmpty': 'Escolha pelo menos um objetivo.',
  'profile.study.availabilityTitle': 'Tempo para estudar',
  'profile.study.availabilityDescription':
    'Quantos minutos você consegue estudar em cada dia. O plano se ajusta a isso.',
  'profile.study.weeklyTotal': 'Total por semana: {minutes} min',
  'profile.study.targetTitle': 'Sua meta',
  'profile.study.targetLevel': 'Nível que você quer alcançar',
  'profile.study.targetDate': 'Data-alvo (opcional)',
  'profile.study.targetDateHint':
    'O plano usa a data para avisar se o seu ritmo dá conta.',
  'profile.study.targetDateClear': 'Tirar a data-alvo',
  'profile.study.targetDatePast': 'Escolha uma data a partir de amanhã.',
  'profile.study.interestsTitle': 'Interesses',
  'profile.study.interestsDescription':
    'Os materiais e os exemplos puxam para esses temas.',
  'profile.study.save': 'Salvar',
  'profile.study.saved': 'Estudo atualizado.',
  'profile.study.savedReplan': 'Salvo. Estamos recalculando o seu plano.',
  'profile.study.saveError':
    'Não conseguimos salvar agora. Nada mudou; tente de novo.',
  'profile.study.partialError':
    'Parte das mudanças foi salva e parte não. Confira a tela e tente de novo.',
  'profile.study.replanTitle': 'Recalcular o seu plano?',
  'profile.study.replanDescription':
    'O que você mudou altera o seu plano de estudo. Vamos recalcular a trilha e a agenda com isso. O que você já estudou continua contando.',
  'profile.study.replanConfirm': 'Salvar e recalcular',
  'profile.study.replanBack': 'Voltar',

  'profile.notifications.title': 'Notificações',
  'profile.notifications.description':
    'Escolha o que avisar e quando. No máximo um lembrete por dia.',
  'profile.notifications.errorTitle':
    'Não conseguimos carregar suas notificações',
  'profile.notifications.saved': 'Preferência salva.',
  'profile.notifications.saveError':
    'Não conseguimos salvar agora. Nada mudou; tente de novo.',
  'profile.notifications.channelsTitle': 'Por onde avisar',
  'profile.notifications.channelEmail': 'E-mail',
  'profile.notifications.allOff':
    'Com e-mail e navegador desligados, você não recebe nenhum aviso.',
  'profile.notifications.typesTitle': 'O que avisar',
  'profile.notifications.typeDaily': 'Lembrete diário',
  'profile.notifications.typeDailyHint':
    'Quando o plano de hoje ainda não foi começado.',
  'profile.notifications.typeReview': 'Revisões acumulando',
  'profile.notifications.typeReviewHint':
    'Quando passam de 25 as revisões vencidas.',
  'profile.notifications.typeWeekly': 'Resumo semanal',
  'profile.notifications.typeWeeklyHint':
    'Toda segunda-feira, por e-mail, com os números da semana.',
  'profile.notifications.timeTitle': 'Horários',
  'profile.notifications.reminderHour': 'Hora do lembrete',
  'profile.notifications.followStudyTime':
    'Seguir o meu horário de estudo ({hour})',
  'profile.notifications.quietTitle': 'Horário silencioso',
  'profile.notifications.quietDescription':
    'Nesse intervalo, nenhum aviso é enviado.',
  'profile.notifications.quietStart': 'Começa às',
  'profile.notifications.quietEnd': 'Termina às',
  'profile.notifications.hourInQuiet':
    'Essa hora cai no horário silencioso. Escolha outra ou ajuste o silencioso.',
  'profile.notifications.quietCoversReminder':
    'O lembrete de {hour} cairia dentro desse silencioso. Mude a hora do lembrete primeiro.',

  'profile.push.title': 'Avisos no navegador',
  'profile.push.description':
    'Um aviso na tela do computador ou do celular, mesmo com o site fechado.',
  'profile.push.enable': 'Ativar avisos no navegador',
  'profile.push.disable': 'Desativar neste navegador',
  'profile.push.test': 'Enviar um aviso de teste',
  'profile.push.testSent':
    'Enviamos um aviso de teste. Ele deve aparecer em instantes.',
  'profile.push.testNotDelivered':
    'Não conseguimos entregar o teste neste navegador. Tente ativar de novo.',
  'profile.push.activeOne': 'Ativo em {count} dispositivo.',
  'profile.push.activeMany': 'Ativo em {count} dispositivos.',
  'profile.push.activeNotHere':
    'Este navegador ainda não está inscrito. Ative para receber aqui.',
  'profile.push.unsupported':
    'Este navegador não recebe avisos. No iPhone, instale o site na tela inicial (Compartilhar → Adicionar à Tela de Início) para receber. Por e-mail já funciona.',
  'profile.push.denied':
    'Você bloqueou os avisos neste navegador. Para ativar, libere as notificações deste site nas configurações do navegador.',
  'profile.push.dismissed':
    'Você fechou o pedido sem escolher. Quando quiser, é só tentar de novo.',
  'profile.push.unavailable':
    'Os avisos no navegador ainda não estão disponíveis. Por enquanto, os lembretes vão por e-mail.',
  'profile.push.error': 'Não conseguimos mudar os avisos agora. Tente de novo.',

  'profile.privacy.title': 'Privacidade e conta',
  'profile.privacy.consentsTitle': 'Consentimentos',
  'profile.privacy.consentsDescription':
    'O que você aceitou, e a versão do documento que valia na hora.',
  'profile.privacy.consentTERMS': 'Termos de uso',
  'profile.privacy.consentPRIVACY_POLICY': 'Política de privacidade',
  'profile.privacy.consentDATA_PERSONALIZATION':
    'Personalizar meu estudo com base no meu progresso e nos meus interesses',
  'profile.privacy.consentMARKETING': 'Receber novidades e ofertas por e-mail',
  'profile.privacy.consentRequired': 'Obrigatório para ter uma conta.',
  'profile.privacy.consentVersion': 'Versão {version}',
  'profile.privacy.consentGranted': 'Aceito em {date} · versão {version}',
  'profile.privacy.consentRevoked': 'Retirado em {date}',
  'profile.privacy.consentNever': 'Ainda não respondido',
  'profile.privacy.consentOutdated': 'Há uma versão nova deste documento.',
  'profile.privacy.consentAccept': 'Aceitar a versão nova',
  'profile.privacy.consentError':
    'Não conseguimos salvar agora. Nada mudou; tente de novo.',
  'profile.privacy.consentsErrorTitle':
    'Não conseguimos carregar seus consentimentos',
  'profile.privacy.revokeTitle': 'Retirar a personalização?',
  'profile.privacy.revokeDescription':
    'Esse aceite é o que permite ajustar o seu estudo ao seu progresso, e a personalização é o centro da plataforma. Registramos a sua escolha; se quiser parar de vez, você também pode excluir a conta, mais abaixo.',
  'profile.privacy.revokeConfirm': 'Retirar consentimento',
  'profile.privacy.revokeKeep': 'Manter',

  'profile.export.title': 'Meus dados',
  'profile.export.description':
    'Baixe uma cópia dos dados da sua conta, em um arquivo JSON.',
  'profile.export.request': 'Pedir meus dados',
  'profile.export.requestAgain': 'Pedir de novo',
  'profile.export.retry': 'Tentar de novo',
  'profile.export.pending':
    'Estamos juntando seus dados. Pode sair desta tela: o link aparece aqui quando ficar pronto.',
  'profile.export.ready': 'Seus dados estão prontos.',
  'profile.export.download': 'Baixar meus dados',
  'profile.export.readyInfo': 'Tamanho: {size} · o link vale até {date}.',
  'profile.export.expired':
    'O link do último pedido venceu. Peça de novo para gerar outro.',
  'profile.export.failed': 'Não conseguimos montar seus dados. Tente de novo.',
  'profile.export.requestError':
    'Não conseguimos fazer o pedido agora. Tente de novo.',
  'profile.export.loadError': 'Não conseguimos ver o estado do seu pedido.',

  'profile.delete.title': 'Excluir minha conta',
  'profile.delete.description':
    'Sua conta sai do ar na hora e seus dados pessoais são anonimizados em {days} dias. Depois disso, não dá para recuperar.',
  'profile.delete.open': 'Excluir minha conta',
  'profile.delete.dialogTitle': 'Excluir a sua conta?',
  'profile.delete.pointNow':
    'Sua conta sai do ar agora e você é desconectado de todos os dispositivos.',
  'profile.delete.pointAnonymize':
    'Em {days} dias, seu nome, e-mail e dados pessoais são anonimizados. Não há como desfazer depois disso.',
  'profile.delete.pointSubscription':
    'Se você tem assinatura, ela é cancelada.',
  'profile.delete.pointExport':
    'Quer guardar seus dados? Peça a exportação antes de excluir.',
  'profile.delete.confirmWord': 'EXCLUIR',
  'profile.delete.confirmLabel': 'Para confirmar, digite {word}',
  'profile.delete.confirm': 'Excluir minha conta',
  'profile.delete.keep': 'Manter minha conta',
  'profile.delete.error':
    'Não conseguimos excluir sua conta agora. Nada foi alterado; tente de novo.',

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
  'paywall.viewPlans': 'Ver planos',

  'plans.title': 'Planos',
  'plans.monthly': 'Mensal',
  'plans.yearly': 'Anual',
  'plans.currentBadge': 'Seu plano atual',
  'plans.subscribe': 'Assinar',
  'plans.errorTitle': 'Não conseguimos carregar os planos',
  'plans.faqTitle': 'Perguntas frequentes',

  'checkout.title': 'Finalizar assinatura',
  'checkout.paymentMethod': 'Forma de pagamento',
  'checkout.cpfCnpj': 'CPF ou CNPJ',
  'checkout.cpfCnpjHint': 'Só os números — é o que o pagamento exige.',
  'checkout.submit': 'Continuar',
  'checkout.preparing': 'Preparando seu link de pagamento…',
  'checkout.waitingTitle': 'Aguardando pagamento',
  'checkout.waitingDescription':
    'Assim que o pagamento for confirmado, esta tela atualiza sozinha.',
  'checkout.reopenLink': 'Abrir o link de pagamento de novo',
  'checkout.successTitle': 'Pagamento confirmado',
  'checkout.successDescription': 'Seu plano já está liberado.',
  'checkout.goToSubscription': 'Ver minha assinatura',
  'checkout.failedTitle': 'Não deu certo desta vez',
  'checkout.failedDescription':
    'O checkout expirou ou foi cancelado. Você pode tentar de novo.',
  'checkout.backToPlans': 'Voltar para os planos',
  'checkout.noParamsTitle': 'Nenhum plano escolhido',
  'checkout.noParamsDescription': 'Escolha um plano antes de finalizar.',

  'subscription.title': 'Minha assinatura',
  'subscription.errorTitle': 'Não conseguimos carregar sua assinatura',
  'subscription.upgrade': 'Fazer upgrade',
  'subscription.viewPlans': 'Ver planos',
  'subscription.cancel': 'Cancelar assinatura',
  'subscription.creditsTitle': 'Créditos de IA',
  'subscription.creditsMonthly': 'Cota mensal:',
  'subscription.creditsHistoryEmpty': 'Nenhum lançamento ainda.',
  'subscription.cancelConfirm.title': 'Cancelar assinatura?',
  'subscription.cancelConfirm.descriptionPrefix':
    'Seu acesso ao plano pago continua até',
  'subscription.cancelConfirm.descriptionNoAccess':
    'O cancelamento vale a partir de agora.',
  'subscription.cancelConfirm.stay': 'Manter assinatura',
  'subscription.cancelConfirm.confirm': 'Cancelar mesmo assim',

  'tools.title': 'Ferramentas do Plus',
  'tools.subtitle':
    'Material de estudo feito para você, no seu nível, sobre o que você gosta.',
  'tools.balance': 'Seu saldo',
  'tools.creditsUnit': 'créditos',
  'tools.cost': '{cost} créditos por material',
  'tools.topic.title': 'Tema que eu gosto',
  'tools.topic.description':
    'Você diz um interesse e a gente monta um texto sobre um fato real, com fonte.',
  'tools.ingest.title': 'Colar conteúdo',
  'tools.ingest.description':
    'Uma reportagem, uma letra de música ou o link de um artigo vira material de estudo.',
  'tools.start': 'Começar',
  'tools.myMaterials': 'Meus materiais',
  'tools.pending.title': 'Tem um material sendo montado',
  'tools.pending.resume': 'Acompanhar',
  'tools.errorTitle': 'Não conseguimos carregar suas ferramentas',

  'tools.sample.title': 'Isso faz parte do plano Plus',
  'tools.sample.description':
    'Veja um pedaço de um material de verdade. No Plus, você recebe um desses sobre o assunto que quiser, no seu nível.',
  'tools.sample.badge': 'Exemplo',
  'tools.sample.cta': 'Conhecer o Plus',

  'tools.card.plusTitle': 'Ferramentas do Plus',
  'tools.card.plusDescription':
    'Monte um material sobre um tema que você gosta ou cole um texto.',
  'tools.card.plusAction': 'Abrir ferramentas',
  'tools.card.freeTitle': 'Estude com o que você gosta',
  'tools.card.freeDescription':
    'No Plus, a IA monta material no seu nível sobre um tema seu ou um texto que você colar.',
  'tools.card.freeAction': 'Ver como funciona',

  'topic.title': 'Tema que eu gosto',
  'topic.interestLabel': 'Do que você gosta?',
  'topic.interestPlaceholder':
    'Ex.: gosto de história, principalmente navegações',
  'topic.fromProfile': 'Dos seus interesses',
  'topic.suggest': 'Ver sugestões',
  'topic.suggestFree': 'Sugerir assuntos não gasta crédito.',
  'topic.thinking': 'Pensando em assuntos para você…',
  'topic.suggestionsTitle': 'Escolha um assunto',
  'topic.choose': 'Quero esse',
  'topic.surprise': 'Surpreenda-me',
  'topic.surpriseHint': 'A gente escolhe pelos seus interesses.',
  'topic.ownTitleLabel': 'Ou digite um assunto',
  'topic.ownTitlePlaceholder': 'Ex.: a viagem de Fernão de Magalhães',
  'topic.ownTitleSubmit': 'Usar este assunto',
  'topic.again': 'Mudar o interesse',

  'ingest.title': 'Colar conteúdo',
  'ingest.tabText': 'Texto',
  'ingest.tabLink': 'Link de artigo',
  'ingest.textLabel': 'Cole o texto em inglês',
  'ingest.textHint': 'Uma reportagem, um post, a letra de uma música.',
  'ingest.linkLabel': 'Link do artigo',
  'ingest.linkPlaceholder': 'https://',
  'ingest.linkHint':
    'A gente lê a página e monta o material. Se o site não deixar, é só colar o texto.',
  'ingest.socialTitle': 'Não baixamos vídeo nem post de rede social',
  'ingest.socialDescription':
    'No momento, para links do {platform}, cole também a legenda ou a transcrição aqui embaixo.',
  'ingest.transcriptLabel': 'Legenda ou transcrição',
  'ingest.counter': '{count} / {max}',
  'ingest.tooShort': 'Faltam {count} caracteres para o mínimo.',
  'ingest.tooLong': 'Passou do limite em {count} caracteres.',
  'ingest.limits': 'Mínimo de {min} e máximo de {max} caracteres.',
  'ingest.submit': 'Montar material',

  'job.title': 'Montando seu material',
  'job.leaveHint':
    'Pode sair desta tela: o material continua sendo montado e aparece em Meus materiais.',
  'job.openMaterial': 'Abrir o material',
  'job.tryAgain': 'Tentar de novo',
  'job.backToTools': 'Voltar às ferramentas',
  'job.errorTitle': 'Não encontramos esse pedido',

  'credits.insufficientTitle': 'Seus créditos não dão para isso agora',
  'credits.insufficientBody':
    'Você tem {balance} créditos e cada material custa {cost}.',
  'credits.renews': 'Seus créditos renovam em {date}.',
  'credits.viewPlans': 'Ver planos',
  'credits.viewSubscription': 'Minha assinatura',

  'material.basedOn': 'Baseado em:',
  'material.basedOnPasted': 'Baseado no texto que você mandou.',
  'material.textTitle': 'Texto',
  'material.textHint': 'Toque num destaque para ver a explicação.',
  'material.spotlightTitle': 'Estrutura em foco',
  'material.spokenTitle': 'Como se fala',
  'material.registerNotesTitle': 'Falado × padrão',
  'material.vocabularyTitle': 'Vocabulário',
  'material.inReview': 'Na revisão ✓',
  'material.removeFromReview': 'Remover',
  'material.addToReview': 'Adicionar à revisão',
  'material.exercisesTitle': 'Exercícios',
  'material.alreadyCorrect': 'Você já respondeu: acertou.',
  'material.alreadyWrong': 'Você já respondeu: errou.',
  'material.answerError': 'Não conseguimos enviar sua resposta. Tenta de novo.',
  'material.rateTitle': 'O que achou deste material?',
  'material.rateLiked': 'Gostei',
  'material.rateTooEasy': 'Fácil demais',
  'material.rateTooHard': 'Difícil demais',
  'material.rateThanks': 'Valeu — os próximos materiais levam isso em conta.',
  'material.errorTitle': 'Não conseguimos abrir este material',

  'materials.title': 'Meus materiais',
  'materials.empty.title': 'Nenhum material ainda',
  'materials.empty.description':
    'Quando você montar um material nas ferramentas do Plus, ele aparece aqui.',
  'materials.new': 'Montar um material',
  'materials.evolutionTitle': 'Seu nível nos materiais',
  'materials.evolutionUp':
    'Você subiu {steps} nível desde o primeiro material.',
  'materials.evolutionUpMany':
    'Você subiu {steps} níveis desde o primeiro material.',
  'materials.evolutionSame':
    'Seus materiais estão no mesmo nível desde o primeiro.',
  'materials.evolutionDown':
    'Os materiais mais recentes estão num nível abaixo — a gente ajusta pelo que você avalia.',
  'materials.exercises': '{count} exercícios',
  'materials.loadMore': 'Carregar mais',
  'materials.errorTitle': 'Não conseguimos carregar seus materiais',

  'progress.title': 'Seu progresso',
  'progress.period.label': 'Período',
  'progress.period.weeks': '{count} semanas',
  'progress.errorTitle': 'Não conseguimos carregar seu progresso',

  'progress.empty.title': 'Seu progresso começa na primeira lição',
  'progress.empty.description':
    'Assim que você responder algumas questões, a gente mostra seu nível em cada habilidade, como ele evolui e o que vale reforçar.',
  'progress.empty.placement': 'Fazer o nivelamento',
  'progress.empty.today': 'Ver a agenda de hoje',

  'progress.level.title': 'Seu nível',
  'progress.level.overallPrefix': 'Nível geral',
  'progress.level.chartTitle': 'Nível por habilidade',
  'progress.level.chartDescription':
    'Até onde você chega em cada habilidade, do A1 ao C1.',
  'progress.level.rowHeader': 'Habilidade',
  'progress.level.valueHeader': 'Nível',
  'progress.level.lowConfidence': 'Poucos dados',
  'progress.level.solidLegend': 'Estimativa com dados suficientes',
  'progress.level.hatchedLegend': 'Poucos dados — pode mudar',
  'progress.level.empty': 'Sem dados ainda',

  'progress.evolution.title': 'Evolução do nível',
  'progress.evolution.description': 'Seu nível ao longo das semanas.',
  'progress.evolution.overall': 'Geral',
  'progress.evolution.rowHeader': 'Semana',
  'progress.evolution.empty': 'Ainda não há histórico de nível neste período.',
  'progress.evolution.target': 'Meta: {level}',

  'progress.forecast.title': 'Previsão de chegada',
  'progress.forecast.target': 'Seu objetivo: nível {level}',
  'progress.forecast.byPlan': 'Pelo cronograma: {date}',
  'progress.forecast.byPace': 'Pelo seu ritmo: {date}',
  'progress.forecast.ON_TRACK': 'No ritmo',
  'progress.forecast.AHEAD': 'Adiantado',
  'progress.forecast.BEHIND': 'Atrás do previsto',
  'progress.forecast.TOO_EARLY': 'Ainda é cedo',
  'progress.forecast.NO_STUDY': 'Sem estudo recente',
  'progress.forecast.NO_PLAN': 'Sem cronograma',

  'progress.strengths.title': 'Pontos fortes',
  'progress.strengths.empty':
    'Seus pontos fortes aparecem depois de algumas questões.',
  'progress.weaknesses.title': 'Para reforçar',
  'progress.weaknesses.empty': 'Nenhum ponto fraco por enquanto. Bom sinal.',
  'progress.action.lesson': 'Ver lição',
  'progress.action.practice': 'Praticar agora',
  'progress.action.material': 'Gerar material sobre isso',

  'progress.errors.title': 'Erros mais frequentes',
  'progress.errors.empty': 'Nenhum erro se repetindo por enquanto.',
  'progress.errors.correction': 'Melhor assim:',
  'progress.errors.occurrences': 'Apareceu {count} de {total} vezes recentes',
  'progress.errors.yourExamples': 'O que você escreveu:',

  'progress.plan.title': 'Cumprimento do plano',
  'progress.plan.description': 'Minutos planejados e estudados em cada semana.',
  'progress.plan.planned': 'Planejado',
  'progress.plan.done': 'Feito',
  'progress.plan.minutes': '{count} min',
  'progress.plan.rowHeader': 'Semana',
  'progress.plan.empty': 'Sem semanas com plano neste período.',

  'progress.stats.minutes': 'Minutos estudados',
  'progress.stats.lessons': 'Lições concluídas',
  'progress.stats.reviews': 'Revisões feitas',
  'progress.stats.streak': 'Sequência atual',
  'progress.stats.longestStreak': 'Maior sequência',
  'progress.stats.day': '{count} dia',
  'progress.stats.days': '{count} dias',
} as const;

type MessageKey = keyof typeof messages;

/** `{nome}` no texto é trocado por `params.nome` — sem lib de i18n. */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const text: string = messages[key];

  if (params === undefined) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
