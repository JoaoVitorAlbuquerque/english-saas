import request from 'supertest';

import { ConsoleMailService } from 'src/infra/mail/console-mail.service';
import { FakeGoogleOAuthService } from 'src/modules/auth/services/fake-google-oauth.service';
import { GoogleOAuthClient } from 'src/modules/auth/services/google-oauth.client';

import {
  createTestApp,
  extractCookies,
  type TestApp,
} from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

describe('Auth (e2e)', () => {
  let context: TestApp;
  let mail: ConsoleMailService;
  let google: FakeGoogleOAuthService;

  beforeAll(async () => {
    context = await createTestApp();
    mail = context.app.get(ConsoleMailService);
    google = context.app.get(GoogleOAuthClient) as FakeGoogleOAuthService;
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.resetRateLimit();
    mail.clear();
    google.reset();
  });

  afterAll(async () => {
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  function signup(email: string) {
    return http().post('/auth/signup').send({
      name: 'Aluno Teste',
      email,
      password: PASSWORD,
      acceptedTerms: true,
      acceptedPrivacyPolicy: true,
      acceptedDataPersonalization: true,
    });
  }

  // -------------------------------------------------------------------
  // Cadastro
  // -------------------------------------------------------------------

  it('cria a conta, devolve o access token e grava o refresh no cookie', async () => {
    const response = await signup('novo@exemplo.com');

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: 'novo@exemplo.com',
      role: 'STUDENT',
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    // O refresh nunca aparece no corpo.
    expect(JSON.stringify(response.body)).not.toContain('refresh_token');

    const cookies = extractCookies(response);
    expect(cookies.refreshToken).toBeDefined();
    expect(cookies.raw.refresh_token).toContain('HttpOnly');
    expect(cookies.raw.refresh_token).toContain('SameSite=Lax');
    expect(cookies.raw.refresh_token).toContain('Path=/auth');
    // O CSRF precisa ser legível pelo front em qualquer rota do SPA, não só
    // em /auth/*: Path restringe `document.cookie` pelo path do documento
    // atual, não pelo destino da requisição.
    expect(cookies.raw.csrf_token).not.toContain('HttpOnly');
    expect(cookies.raw.csrf_token).toMatch(/(?:^|; )Path=\/(?:;|$)/);
    expect(response.body.csrfToken).toBe(cookies.csrfToken);
  });

  it('normaliza o e-mail e recusa o mesmo endereço duas vezes', async () => {
    await signup('Duplicado@Exemplo.com').expect(201);

    const second = await signup('duplicado@exemplo.com');

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('recusa senha fraca com mensagem em pt-BR', async () => {
    const response = await http().post('/auth/signup').send({
      name: 'Aluno',
      email: 'fraca@exemplo.com',
      password: 'abcdefgh',
      acceptedTerms: true,
      acceptedPrivacyPolicy: true,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('WEAK_PASSWORD');
    expect(response.body.error.message).toContain('número');
  });

  it('exige aceite de termos e política', async () => {
    const response = await http().post('/auth/signup').send({
      name: 'Aluno',
      email: 'semtermos@exemplo.com',
      password: PASSWORD,
      acceptedTerms: false,
      acceptedPrivacyPolicy: true,
    });

    expect(response.status).toBe(400);
  });

  it('registra os consentimentos do cadastro com versão e data', async () => {
    const created = await signup('consent@exemplo.com').expect(201);

    const response = await http()
      .get('/me/consents')
      .set('Authorization', `Bearer ${created.body.accessToken}`)
      .expect(200);

    const terms = response.body.find(
      (item: { type: string }) => item.type === 'TERMS',
    );
    expect(terms).toMatchObject({ granted: true, upToDate: true });
    expect(terms.grantedAt).toEqual(expect.any(String));

    const marketing = response.body.find(
      (item: { type: string }) => item.type === 'MARKETING',
    );
    expect(marketing.granted).toBe(false);
  });

  it('envia o e-mail de verificação no cadastro', async () => {
    await signup('verificar@exemplo.com').expect(201);

    const sent = mail.lastTo('verificar@exemplo.com');
    expect(sent?.subject).toBe('Confirme seu e-mail');
    expect(sent?.text).toContain('/auth/verify-email?token=');
  });

  it('confirma o e-mail pelo token do link', async () => {
    const created = await signup('confirma@exemplo.com').expect(201);
    const token = tokenFromMail(mail.lastTo('confirma@exemplo.com')?.text);

    await http().post('/auth/verify-email').send({ token }).expect(200);

    const me = await http()
      .get('/me')
      .set('Authorization', `Bearer ${created.body.accessToken}`)
      .expect(200);

    expect(me.body.emailVerifiedAt).toEqual(expect.any(String));
  });

  it('recusa o mesmo token de verificação duas vezes', async () => {
    await signup('umauso@exemplo.com').expect(201);
    const token = tokenFromMail(mail.lastTo('umauso@exemplo.com')?.text);

    await http().post('/auth/verify-email').send({ token }).expect(200);

    const second = await http().post('/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_TOKEN');
  });

  // -------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------

  it('entra com e-mail e senha', async () => {
    await signup('login@exemplo.com').expect(201);

    const response = await http()
      .post('/auth/signin')
      .send({ email: 'login@exemplo.com', password: PASSWORD })
      .expect(200);

    expect(response.body.user.email).toBe('login@exemplo.com');
  });

  it('dá a mesma resposta para senha errada e conta inexistente', async () => {
    await signup('existe@exemplo.com').expect(201);

    const wrongPassword = await http()
      .post('/auth/signin')
      .send({ email: 'existe@exemplo.com', password: 'outrasenha123' });

    const noAccount = await http()
      .post('/auth/signin')
      .send({ email: 'naoexiste@exemplo.com', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(noAccount.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(noAccount.body.error);
  });

  // -------------------------------------------------------------------
  // Refresh e CSRF
  // -------------------------------------------------------------------

  it('rotaciona a sessão pelo cookie e troca o refresh token', async () => {
    const created = await signup('refresh@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    const response = await http()
      .post('/auth/refresh')
      .set('Cookie', cookies.header)
      .set('x-csrf-token', cookies.csrfToken)
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));

    // O token novo tem que ser diferente do apresentado.
    const rotated = extractCookies(response);
    expect(rotated.refreshToken).not.toBe(cookies.refreshToken);
  });

  it('aceita o refresh com o csrf_token legado (Path=/auth) chegando antes do atual, e apaga o legado', async () => {
    const created = await signup('legado@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    // Ordem que o browser usa em /auth/*: path mais específico primeiro.
    const response = await http()
      .post('/auth/refresh')
      .set(
        'Cookie',
        `csrf_token=valor-antigo; refresh_token=${cookies.refreshToken}; csrf_token=${cookies.csrfToken}`,
      )
      .set('x-csrf-token', cookies.csrfToken)
      .expect(200);

    const setCookies = ([] as string[]).concat(
      response.headers['set-cookie'] ?? [],
    );
    expect(
      setCookies.some(
        (cookie) =>
          cookie.startsWith('csrf_token=;') && cookie.includes('Path=/auth'),
      ),
    ).toBe(true);
  });

  it('recusa o refresh sem o header de CSRF', async () => {
    const created = await signup('csrf@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    const response = await http()
      .post('/auth/refresh')
      .set('Cookie', cookies.header);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_MISMATCH');
  });

  it('recusa o refresh quando o header não bate com o cookie', async () => {
    const created = await signup('csrf2@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    const response = await http()
      .post('/auth/refresh')
      .set('Cookie', cookies.header)
      .set('x-csrf-token', 'valor-de-outro-site');

    expect(response.status).toBe(403);
  });

  it('derruba a família inteira quando um refresh token é reusado', async () => {
    const created = await signup('roubo@exemplo.com').expect(201);
    const first = extractCookies(created);

    // Uso legítimo: rotaciona.
    const rotated = await http()
      .post('/auth/refresh')
      .set('Cookie', first.header)
      .set('x-csrf-token', first.csrfToken)
      .expect(200);

    // O atacante tenta o token antigo.
    const replay = await http()
      .post('/auth/refresh')
      .set('Cookie', first.header)
      .set('x-csrf-token', first.csrfToken);

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_EXPIRED');

    // E o token legítimo também morre: a família foi revogada.
    const second = extractCookies(rotated);
    const afterRevoke = await http()
      .post('/auth/refresh')
      .set('Cookie', second.header)
      .set('x-csrf-token', second.csrfToken);

    expect(afterRevoke.status).toBe(401);
  });

  it('logout encerra a sessão e limpa os cookies', async () => {
    const created = await signup('sair@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    const response = await http()
      .post('/auth/logout')
      .set('Cookie', cookies.header)
      .set('x-csrf-token', cookies.csrfToken)
      .expect(204);

    expect(String(response.headers['set-cookie'])).toContain('refresh_token=;');

    const afterLogout = await http()
      .post('/auth/refresh')
      .set('Cookie', cookies.header)
      .set('x-csrf-token', cookies.csrfToken);

    expect(afterLogout.status).toBe(401);
  });

  // -------------------------------------------------------------------
  // Recuperação de senha
  // -------------------------------------------------------------------

  it('responde igual para e-mail cadastrado e não cadastrado', async () => {
    await signup('esqueci@exemplo.com').expect(201);

    const known = await http()
      .post('/auth/forgot-password')
      .send({ email: 'esqueci@exemplo.com' });
    const unknown = await http()
      .post('/auth/forgot-password')
      .send({ email: 'ninguem@exemplo.com' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  it('redefine a senha e derruba as sessões antigas', async () => {
    const created = await signup('trocar@exemplo.com').expect(201);
    const cookies = extractCookies(created);

    await http()
      .post('/auth/forgot-password')
      .send({ email: 'trocar@exemplo.com' })
      .expect(202);

    const token = tokenFromMail(mail.lastTo('trocar@exemplo.com')?.text);

    await http()
      .post('/auth/reset-password')
      .send({ token, password: 'novasenha2026' })
      .expect(200);

    // A senha nova entra.
    await http()
      .post('/auth/signin')
      .send({ email: 'trocar@exemplo.com', password: 'novasenha2026' })
      .expect(200);

    // A antiga não.
    await http()
      .post('/auth/signin')
      .send({ email: 'trocar@exemplo.com', password: PASSWORD })
      .expect(401);

    // E a sessão anterior foi revogada.
    const oldSession = await http()
      .post('/auth/refresh')
      .set('Cookie', cookies.header)
      .set('x-csrf-token', cookies.csrfToken);

    expect(oldSession.status).toBe(401);
  });

  // -------------------------------------------------------------------
  // Google
  // -------------------------------------------------------------------

  it('cria a conta pelo Google com o e-mail já verificado', async () => {
    const urlResponse = await http().get('/auth/google/url').expect(200);

    expect(urlResponse.body.url).toContain('code_challenge');

    google.setProfile('code-abc', {
      providerAccountId: 'google-1',
      email: 'google@exemplo.com',
      emailVerified: true,
      name: 'Gabi Google',
    });

    const response = await http()
      .post('/auth/google/callback')
      .send({ code: 'code-abc', state: urlResponse.body.state })
      .expect(200);

    expect(response.body.user.email).toBe('google@exemplo.com');
    expect(extractCookies(response).refreshToken).toBeDefined();
  });

  it('recusa reutilizar o mesmo state (replay)', async () => {
    const urlResponse = await http().get('/auth/google/url').expect(200);

    google.setProfile('code-xyz', {
      providerAccountId: 'google-2',
      email: 'replay@exemplo.com',
      emailVerified: true,
      name: 'Replay',
    });

    await http()
      .post('/auth/google/callback')
      .send({ code: 'code-xyz', state: urlResponse.body.state })
      .expect(200);

    const second = await http()
      .post('/auth/google/callback')
      .send({ code: 'code-xyz', state: urlResponse.body.state });

    expect(second.status).toBe(401);
    expect(second.body.error.code).toBe('OAUTH_FAILED');
  });

  it('liga o Google a uma conta que já existia com o mesmo e-mail', async () => {
    await signup('mesmo@exemplo.com').expect(201);

    const urlResponse = await http().get('/auth/google/url').expect(200);
    google.setProfile('code-link', {
      providerAccountId: 'google-3',
      email: 'mesmo@exemplo.com',
      emailVerified: true,
      name: 'Mesmo',
    });

    const response = await http()
      .post('/auth/google/callback')
      .send({ code: 'code-link', state: urlResponse.body.state })
      .expect(200);

    // Mesma conta, não uma segunda.
    const users = await context.prisma.user.findMany({
      where: { email: 'mesmo@exemplo.com' },
    });
    expect(users).toHaveLength(1);
    expect(response.body.user.id).toBe(users[0]?.id);
  });

  it('recusa conta do Google sem e-mail verificado', async () => {
    const urlResponse = await http().get('/auth/google/url').expect(200);
    google.setProfile('code-unverified', {
      providerAccountId: 'google-4',
      email: 'naoverificado@exemplo.com',
      emailVerified: false,
      name: 'Não verificado',
    });

    const response = await http()
      .post('/auth/google/callback')
      .send({ code: 'code-unverified', state: urlResponse.body.state });

    expect(response.status).toBe(401);
  });
});

/** Pega o `token=` do link dentro do corpo do e-mail. */
function tokenFromMail(body: string | undefined): string {
  const match = /token=([^\s&]+)/.exec(body ?? '');

  if (match?.[1] === undefined) {
    throw new Error('Nenhum token encontrado no e-mail.');
  }

  return decodeURIComponent(match[1]);
}
