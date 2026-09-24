import { Role } from '@prisma/client';
import request from 'supertest';

import { DataExportService } from 'src/modules/users/services/data-export.service';
import { UsersService } from 'src/modules/users/services/users.service';

import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

describe('Users, onboarding e LGPD (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp();
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.resetRateLimit();
  });

  afterAll(async () => {
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function signupAndGetToken(
    email = 'aluno@exemplo.com',
  ): Promise<{ token: string; userId: string }> {
    const response = await http()
      .post('/auth/signup')
      .send({
        name: 'Aluno Teste',
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    return {
      token: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  }

  // -------------------------------------------------------------------
  // Guard
  // -------------------------------------------------------------------

  it('recusa /me sem token', async () => {
    await http().get('/me').expect(401);
  });

  it('recusa /me com token inválido', async () => {
    await http()
      .get('/me')
      .set('Authorization', 'Bearer nao-e-um-jwt')
      .expect(401);
  });

  it('devolve a conta do aluno autenticado', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      email: 'aluno@exemplo.com',
      role: 'STUDENT',
    });
    // Nunca devolvemos o hash da senha.
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('atualiza o nome da conta', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Nome' })
      .expect(200);

    expect(response.body.name).toBe('Novo Nome');
  });

  // -------------------------------------------------------------------
  // Guard de papel
  // -------------------------------------------------------------------

  it('bloqueia rota de admin para um aluno', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('libera a rota de admin para quem tem o papel', async () => {
    const { token, userId } = await signupAndGetToken('chefe@exemplo.com');

    await context.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    // O papel vive dentro do JWT, então é preciso um token novo.
    const signin = await http()
      .post('/auth/signin')
      .send({ email: 'chefe@exemplo.com', password: PASSWORD })
      .expect(200);

    expect(signin.body.user.role).toBe('ADMIN');

    await http()
      .get('/admin/users')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);

    // E o token antigo, emitido quando ainda era STUDENT, continua barrado.
    await http()
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  // -------------------------------------------------------------------
  // Perfil e interesses
  // -------------------------------------------------------------------

  it('cria o perfil vazio junto com a conta', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .get('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.onboardingCompletedAt).toBeNull();
    expect(response.body.timezone).toBe('America/Sao_Paulo');
    expect(response.body.nativeLanguage).toBe('pt-BR');
    // A disponibilidade sai sempre com os 7 dias.
    expect(Object.keys(response.body.availabilityMinutes)).toHaveLength(7);
  });

  it('atualiza o perfil e completa os dias faltantes com zero', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .patch('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ availabilityMinutes: { mon: 30, wed: 45 } })
      .expect(200);

    expect(response.body.availabilityMinutes).toEqual({
      mon: 30,
      tue: 0,
      wed: 45,
      thu: 0,
      fri: 0,
      sat: 0,
      sun: 0,
    });
  });

  it('substitui os interesses normalizando tópico e peso', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .put('/me/interests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        interests: [
          { topic: 'history', weight: 90 },
          { topic: 'music', weight: 40 },
        ],
      })
      .expect(200);

    expect(response.body).toEqual([
      { topic: 'history', weight: 90 },
      { topic: 'music', weight: 40 },
    ]);
  });

  it('recusa tópico que não é slug', async () => {
    const { token } = await signupAndGetToken();

    await http()
      .put('/me/interests')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: [{ topic: 'História do Brasil', weight: 50 }] })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // Onboarding
  // -------------------------------------------------------------------

  it('salva o onboarding inteiro de uma vez', async () => {
    const { token, userId } = await signupAndGetToken();

    const response = await http()
      .post('/me/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        goals: ['TRAVEL', 'CONVERSATION'],
        goalNote: 'Viagem em dezembro',
        availabilityMinutes: { mon: 20, wed: 20, sat: 45 },
        preferredStudyTime: 'NIGHT',
        selfReportedLevel: 'BASIC',
        targetDate: '2026-12-15',
        interests: [
          { topic: 'travel', weight: 90 },
          { topic: 'cooking', weight: 60 },
        ],
      })
      .expect(201);

    expect(response.body.onboardingCompletedAt).toEqual(expect.any(String));
    expect(response.body.goals).toEqual(['TRAVEL', 'CONVERSATION']);
    expect(response.body.interests).toHaveLength(2);

    const profile = await context.prisma.studentProfile.findUnique({
      where: { userId },
    });
    expect(profile?.selfReportedLevel).toBe('BASIC');
    expect(profile?.onboardingCompletedAt).not.toBeNull();
  });

  it('exige ao menos um objetivo no onboarding', async () => {
    const { token } = await signupAndGetToken();

    await http()
      .post('/me/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        goals: [],
        availabilityMinutes: { mon: 20 },
        selfReportedLevel: 'BASIC',
      })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // Export de dados (LGPD)
  // -------------------------------------------------------------------

  it('enfileira o export e devolve o id', async () => {
    const { token } = await signupAndGetToken();

    const response = await http()
      .post('/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    expect(response.body.id).toEqual(expect.any(String));

    const latest = await http()
      .get('/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(latest.body.status).toBe('PENDING');
    expect(latest.body.downloadUrl).toBeNull();
  });

  it('gera o arquivo e devolve a URL assinada quando pronto', async () => {
    const { token, userId } = await signupAndGetToken('export@exemplo.com');

    await http()
      .put('/me/interests')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: [{ topic: 'history', weight: 80 }] })
      .expect(200);

    const requested = await http()
      .post('/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    // Roda o job direto: o worker da fila não é o objeto deste teste.
    const dataExport = context.app.get(DataExportService);
    await dataExport.run({ exportId: requested.body.id as string, userId });

    const ready = await http()
      .get('/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ready.body.status).toBe('READY');
    expect(ready.body.sizeBytes).toBeGreaterThan(0);
    expect(ready.body.downloadUrl).toContain('exports/users/');
    expect(ready.body.downloadUrl).toContain('X-Amz-Signature');
  });

  it('não deixa um aluno ver o export de outro', async () => {
    const alice = await signupAndGetToken('alice@exemplo.com');
    const bob = await signupAndGetToken('bob@exemplo.com');

    const requested = await http()
      .post('/me/export')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(202);

    await http()
      .get(`/me/export/${requested.body.id as string}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(404);
  });

  // -------------------------------------------------------------------
  // Exclusão de conta (LGPD)
  // -------------------------------------------------------------------

  it('faz soft delete imediato e agenda a anonimização', async () => {
    const { token, userId } = await signupAndGetToken('sair@exemplo.com');

    const response = await http()
      .delete('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.daysRemaining).toBe(30);

    const user = await context.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(user.deletedAt).not.toBeNull();
    expect(user.anonymizedAt).toBeNull();
    // O e-mail continua lá durante a carência.
    expect(user.email).toBe('sair@exemplo.com');

    // As sessões caem na hora.
    await http()
      .post('/auth/signin')
      .send({ email: 'sair@exemplo.com', password: PASSWORD })
      .expect(403);
  });

  it('anonimiza depois da carência, preservando a linha', async () => {
    const { token, userId } = await signupAndGetToken('anon@exemplo.com');

    await http()
      .delete('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Empurra o soft delete para 31 dias atrás.
    await context.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000) },
    });

    const users = context.app.get(UsersService);
    const due = await users.findDueForAnonymization();
    expect(due).toContain(userId);

    await users.anonymize(userId);

    const user = await context.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(user.anonymizedAt).not.toBeNull();
    expect(user.name).toBe('Conta removida');
    expect(user.email).not.toContain('anon@exemplo.com');
    expect(user.passwordHash).toBeNull();

    const interests = await context.prisma.studentInterest.findMany({
      where: { userId },
    });
    expect(interests).toHaveLength(0);
  });

  it('não anonimiza quem ainda está na carência', async () => {
    const { token, userId } = await signupAndGetToken('recente@exemplo.com');

    await http()
      .delete('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const users = context.app.get(UsersService);

    expect(await users.findDueForAnonymization()).not.toContain(userId);
  });
});
