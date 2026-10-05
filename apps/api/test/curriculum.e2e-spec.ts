import { Role } from '@prisma/client';
import request from 'supertest';

import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Fluxo completo do módulo 4: autoria → revisão → publicação → catálogo.
 *
 * Cada suíte monta o próprio conteúdo pela API de autoria, e não pelo seed:
 * é a única forma de provar que o fluxo editorial funciona de ponta a ponta.
 */
describe('Curriculum (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp();
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
  });

  afterAll(async () => {
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function tokenFor(
    role: Role,
    email = `${role.toLowerCase()}@exemplo.com`,
  ): Promise<string> {
    const response = await http()
      .post('/auth/signup')
      .send({
        name: `Usuário ${role}`,
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    const userId = response.body.user.id as string;

    if (role !== Role.STUDENT) {
      await context.prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      // O papel viaja dentro do JWT, então o token precisa ser novo.
      const signin = await http()
        .post('/auth/signin')
        .send({ email, password: PASSWORD })
        .expect(200);

      return signin.body.accessToken as string;
    }

    return response.body.accessToken as string;
  }

  type Fixture = {
    editor: string;
    student: string;
    unitId: string;
    lessonId: string;
    versionId: string;
    itemId: string;
    characterId: string;
    assetId: string;
  };

  /** Monta curso → nível → unidade → personagem → item → lição em DRAFT. */
  async function buildFixture(): Promise<Fixture> {
    const editor = await tokenFor(Role.EDITOR);
    const student = await tokenFor(Role.STUDENT, 'aluno@exemplo.com');
    const admin = (auth: string) => ({ Authorization: `Bearer ${auth}` });

    await http()
      .post('/admin/curriculum/skills')
      .set(admin(editor))
      .send({
        id: 'grammar.be.present.affirmative',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'A1',
        title: 'Verbo to be no presente',
      })
      .expect(201);

    const course = await http()
      .post('/admin/curriculum/courses')
      .set(admin(editor))
      .send({ slug: 'english', title: 'Inglês' })
      .expect(201);

    const level = await http()
      .post('/admin/curriculum/levels')
      .set(admin(editor))
      .send({
        courseId: course.body.id,
        cefrLevel: 'A1',
        title: 'A1',
        order: 0,
        objectives: ['Se apresentar'],
      })
      .expect(201);

    const character = await http()
      .post('/admin/curriculum/characters')
      .set(admin(editor))
      .send({ slug: 'maya', name: 'Maya' })
      .expect(201);

    const asset = await http()
      .post('/admin/curriculum/media-assets')
      .set(admin(editor))
      .send({
        kind: 'AUDIO',
        storageKey: 'content/lessons/teste/scene-1.mp3',
        mimeType: 'audio/mpeg',
      })
      .expect(201);

    const unit = await http()
      .post('/admin/curriculum/units')
      .set(admin(editor))
      .send({
        levelId: level.body.id,
        slug: 'a1-u1',
        order: 0,
        title: 'Episódio 1',
        characterIds: [character.body.id],
      })
      .expect(201);

    await http()
      .post(`/admin/curriculum/units/${unit.body.id}/transition`)
      .set(admin(editor))
      .send({ action: 'submit' })
      .expect(201);
    await http()
      .post(`/admin/curriculum/units/${unit.body.id}/transition`)
      .set(admin(editor))
      .send({ action: 'approve' })
      .expect(201);
    await http()
      .post(`/admin/curriculum/units/${unit.body.id}/transition`)
      .set(admin(editor))
      .send({ action: 'publish' })
      .expect(201);

    const item = await http()
      .post('/admin/curriculum/items')
      .set(admin(editor))
      .send({
        slug: 'a1-be-i-am',
        type: 'MULTIPLE_CHOICE',
        prompt: 'I ___ Maya.',
        content: {
          options: [
            { id: 'am', text: 'am' },
            { id: 'is', text: 'is' },
          ],
          correctOptionIds: ['am'],
        },
        explanation: 'Com "I", o verbo é "am".',
        cefrLevel: 'A1',
        skillIds: ['grammar.be.present.affirmative'],
      })
      .expect(201);

    for (const action of ['submit-for-review', 'approve', 'publish']) {
      await http()
        .post(`/admin/curriculum/items/${item.body.id}/${action}`)
        .set(admin(editor))
        .expect(201);
    }

    const lesson = await http()
      .post('/admin/curriculum/lessons')
      .set(admin(editor))
      .send({
        unitId: unit.body.id,
        slug: 'nice-to-meet-you',
        order: 0,
        title: 'Nice to meet you',
        objective: 'Se apresentar.',
        cefrLevel: 'A1',
        targetSkillIds: ['grammar.be.present.affirmative'],
      })
      .expect(201);

    return {
      editor,
      student,
      unitId: unit.body.id as string,
      lessonId: lesson.body.id as string,
      versionId: lesson.body.versions[0].id as string,
      itemId: item.body.id as string,
      characterId: character.body.id as string,
      assetId: asset.body.id as string,
    };
  }

  function steps(fixture: Fixture) {
    return [
      {
        order: 0,
        type: 'SCENE',
        content: {
          location: 'Corredor do prédio',
          characterIds: [fixture.characterId],
          lines: [
            {
              characterId: fixture.characterId,
              text: "I'm Maya.",
              translation: 'Eu sou a Maya.',
              audioAssetId: fixture.assetId,
              spans: [
                {
                  start: 0,
                  end: 3,
                  kind: 'GRAMMAR',
                  skillId: 'grammar.be.present.affirmative',
                },
              ],
            },
          ],
        },
      },
      {
        order: 1,
        type: 'PRACTICE',
        content: { itemIds: [fixture.itemId] },
      },
      {
        order: 2,
        type: 'SUMMARY',
        content: { takeaways: ["I am / I'm"] },
      },
    ];
  }

  async function publish(fixture: Fixture, versionId: string): Promise<void> {
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/submit-for-review`)
      .set(auth)
      .expect(201);
    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/approve`)
      .set(auth)
      .expect(201);
    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/publish`)
      .set(auth)
      .expect(201);
  }

  // -------------------------------------------------------------------
  // Guard de papel
  // -------------------------------------------------------------------

  it('recusa autoria para quem é aluno', async () => {
    const student = await tokenFor(Role.STUDENT);

    const response = await http()
      .get('/admin/curriculum/skills')
      .set('Authorization', `Bearer ${student}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('recusa o catálogo sem login', async () => {
    await http().get('/catalog/levels').expect(401);
  });

  // -------------------------------------------------------------------
  // Fluxo editorial
  // -------------------------------------------------------------------

  it('não publica direto do rascunho', async () => {
    const fixture = await buildFixture();

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ steps: steps(fixture) })
      .expect(200);

    const response = await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/publish`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .expect(409);

    expect(response.body.error.code).toBe('INVALID_CONTENT_TRANSITION');
  });

  it('leva o rascunho até a publicação e entrega no catálogo', async () => {
    const fixture = await buildFixture();

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ steps: steps(fixture) })
      .expect(200);

    // Antes de publicar, o aluno não enxerga nada.
    await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(404);

    await publish(fixture, fixture.versionId);

    const response = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(response.body.version).toBe(1);
    expect(response.body.steps).toHaveLength(3);
    expect(
      response.body.steps.map((step: { type: string }) => step.type),
    ).toEqual(['SCENE', 'PRACTICE', 'SUMMARY']);
    expect(response.body.targetSkills[0].id).toBe(
      'grammar.be.present.affirmative',
    );
    expect(response.body.characters[0].slug).toBe('maya');
  });

  it('resolve o áudio da cena em URL assinada', async () => {
    const fixture = await buildFixture();

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ steps: steps(fixture) })
      .expect(200);
    await publish(fixture, fixture.versionId);

    const response = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    const asset = response.body.assets[fixture.assetId];

    expect(asset).toBeDefined();
    expect(asset.url).toContain('X-Amz-Signature');
    // A chave crua não vaza para o aluno — só a URL assinada.
    expect(JSON.stringify(response.body)).not.toContain('storageKey');
  });

  it('não entrega o gabarito da questão junto com a lição', async () => {
    const fixture = await buildFixture();

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ steps: steps(fixture) })
      .expect(200);
    await publish(fixture, fixture.versionId);

    const response = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    const serialized = JSON.stringify(response.body.items);

    expect(response.body.items).toHaveLength(1);
    expect(serialized).not.toContain('correctOptionIds');
    expect(serialized).not.toContain('acceptedAnswers');
    expect(serialized).not.toContain('explanation');
  });

  // -------------------------------------------------------------------
  // Versionamento
  // -------------------------------------------------------------------

  it('mantém o aluno na versão publicada enquanto a próxima é escrita', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: steps(fixture) })
      .expect(200);
    await publish(fixture, fixture.versionId);

    const draft = await http()
      .post(`/admin/curriculum/lessons/${fixture.lessonId}/versions`)
      .set(auth)
      .expect(201);

    expect(draft.body.version).toBe(2);
    expect(draft.body.status).toBe('DRAFT');
    // O clone traz as etapas da versão publicada.
    expect(draft.body.steps).toHaveLength(3);

    await http()
      .put(`/admin/curriculum/lesson-versions/${draft.body.id}`)
      .set(auth)
      .send({ title: 'Nice to meet you (revisado)' })
      .expect(200);

    const beforePublish = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(beforePublish.body.version).toBe(1);
    expect(beforePublish.body.title).toBe('Nice to meet you');

    await publish(fixture, draft.body.id);

    const afterPublish = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(afterPublish.body.version).toBe(2);
    expect(afterPublish.body.title).toBe('Nice to meet you (revisado)');

    const lesson = await http()
      .get(`/admin/curriculum/lessons/${fixture.lessonId}`)
      .set(auth)
      .expect(200);

    const v1 = lesson.body.versions.find(
      (version: { version: number }) => version.version === 1,
    );

    expect(v1.status).toBe('ARCHIVED');
  });

  it('não abre duas versões ao mesmo tempo', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: steps(fixture) })
      .expect(200);

    const response = await http()
      .post(`/admin/curriculum/lessons/${fixture.lessonId}/versions`)
      .set(auth)
      .expect(409);

    expect(response.body.error.code).toBe('DRAFT_ALREADY_OPEN');
  });

  it('editar uma versão aprovada devolve ela para rascunho', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: steps(fixture) })
      .expect(200);
    await http()
      .post(
        `/admin/curriculum/lesson-versions/${fixture.versionId}/submit-for-review`,
      )
      .set(auth)
      .expect(201);

    const approved = await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/approve`)
      .set(auth)
      .expect(201);

    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.approvedAt).not.toBeNull();
    expect(approved.body.approvedById).not.toBeNull();

    const edited = await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}`)
      .set(auth)
      .send({ title: 'Outro título' })
      .expect(200);

    expect(edited.body.status).toBe('DRAFT');
    expect(edited.body.approvedAt).toBeNull();
    expect(edited.body.approvedById).toBeNull();
  });

  // -------------------------------------------------------------------
  // Referências
  // -------------------------------------------------------------------

  it('recusa publicar quando uma marcação aponta para skill inexistente', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };
    const broken = steps(fixture);

    (
      broken[0] as { content: { lines: { spans: { skillId: string }[] }[] } }
    ).content.lines[0]!.spans[0]!.skillId = 'grammar.nao.existe';

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: broken })
      .expect(200);
    await http()
      .post(
        `/admin/curriculum/lesson-versions/${fixture.versionId}/submit-for-review`,
      )
      .set(auth)
      .expect(201);
    await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/approve`)
      .set(auth)
      .expect(201);

    const response = await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/publish`)
      .set(auth)
      .expect(422);

    expect(response.body.error.code).toBe('MISSING_REFERENCES');
    expect(response.body.error.details.skills).toContain('grammar.nao.existe');
  });

  /**
   * Questão em DRAFT não chega mais aqui: desde o módulo 5, aprovar a lição
   * publica as questões dela. Quem esta trava ainda pega é a questão
   * **arquivada** — retirada de circulação depois da aprovação, e que
   * deixaria a lição no ar apontando para o vazio.
   */
  it('recusa publicar quando a prática usa questão arquivada', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    const retired = await http()
      .post('/admin/curriculum/items')
      .set(auth)
      .send({
        type: 'MULTIPLE_CHOICE',
        prompt: 'Questão aposentada.',
        content: {
          options: [
            { id: 'a', text: 'a' },
            { id: 'b', text: 'b' },
          ],
          correctOptionIds: ['a'],
        },
        explanation: 'Saiu de circulação.',
        cefrLevel: 'A1',
        skillIds: ['grammar.be.present.affirmative'],
      })
      .expect(201);

    await http()
      .post(`/admin/curriculum/items/${retired.body.id}/archive`)
      .set(auth)
      .expect(201);

    const withRetiredItem = steps(fixture);
    (withRetiredItem[1] as { content: { itemIds: string[] } }).content.itemIds =
      [retired.body.id as string];

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: withRetiredItem })
      .expect(200);
    await http()
      .post(
        `/admin/curriculum/lesson-versions/${fixture.versionId}/submit-for-review`,
      )
      .set(auth)
      .expect(201);
    await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/approve`)
      .set(auth)
      .expect(201);

    const response = await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/publish`)
      .set(auth)
      .expect(422);

    expect(response.body.error.details.items).toContain(retired.body.id);
  });

  it('aprovar a lição publica as questões que ela usa', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    const draftItem = await http()
      .post('/admin/curriculum/items')
      .set(auth)
      .send({
        type: 'MULTIPLE_CHOICE',
        prompt: 'Rascunho.',
        content: {
          options: [
            { id: 'a', text: 'a' },
            { id: 'b', text: 'b' },
          ],
          correctOptionIds: ['a'],
        },
        explanation: 'Ainda em rascunho.',
        cefrLevel: 'A1',
        skillIds: ['grammar.be.present.affirmative'],
      })
      .expect(201);

    const withDraftItem = steps(fixture);
    (withDraftItem[1] as { content: { itemIds: string[] } }).content.itemIds = [
      draftItem.body.id as string,
    ];

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: withDraftItem })
      .expect(200);
    await http()
      .post(
        `/admin/curriculum/lesson-versions/${fixture.versionId}/submit-for-review`,
      )
      .set(auth)
      .expect(201);
    await http()
      .post(`/admin/curriculum/lesson-versions/${fixture.versionId}/approve`)
      .set(auth)
      .expect(201);

    const promoted = await http()
      .get(`/admin/curriculum/items/${draftItem.body.id}`)
      .set(auth)
      .expect(200);

    expect(promoted.body.status).toBe('PUBLISHED');
  });

  it('recusa conteúdo com marcação fora do texto', async () => {
    const fixture = await buildFixture();
    const broken = steps(fixture);

    (
      broken[0] as { content: { lines: { spans: { end: number }[] }[] } }
    ).content.lines[0]!.spans[0]!.end = 999;

    const response = await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ steps: broken })
      .expect(422);

    expect(response.body.error.code).toBe('CONTENT_VALIDATION_FAILED');
    expect(response.body.error.details.issues[0].path).toContain('spans');
  });

  // -------------------------------------------------------------------
  // Imutabilidade da questão
  // -------------------------------------------------------------------

  it('recusa mexer no enunciado de questão publicada', async () => {
    const fixture = await buildFixture();

    const response = await http()
      .patch(`/admin/curriculum/items/${fixture.itemId}`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ prompt: 'Outro enunciado.' })
      .expect(409);

    expect(response.body.error.code).toBe('ITEM_IS_IMMUTABLE');
    expect(response.body.error.details.fields).toContain('prompt');
  });

  it('aceita corrigir a explicação de questão publicada', async () => {
    const fixture = await buildFixture();

    const response = await http()
      .patch(`/admin/curriculum/items/${fixture.itemId}`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ explanation: 'Explicação melhor.' })
      .expect(200);

    expect(response.body.explanation).toBe('Explicação melhor.');
    expect(response.body.status).toBe('PUBLISHED');
  });

  it('cria revisão da questão e aposenta a antiga ao publicar', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    const revision = await http()
      .post(`/admin/curriculum/items/${fixture.itemId}/revisions`)
      .set(auth)
      .send({ prompt: 'I ___ Maya. (revisado)' })
      .expect(201);

    expect(revision.body.status).toBe('DRAFT');
    expect(revision.body.id).not.toBe(fixture.itemId);

    const original = await http()
      .get(`/admin/curriculum/items/${fixture.itemId}`)
      .set(auth)
      .expect(200);

    expect(original.body.replacedById).toBe(revision.body.id);
    // Enquanto a revisão não publica, a original segue no ar.
    expect(original.body.status).toBe('PUBLISHED');

    for (const action of ['submit-for-review', 'approve', 'publish']) {
      await http()
        .post(`/admin/curriculum/items/${revision.body.id}/${action}`)
        .set(auth)
        .expect(201);
    }

    const archived = await http()
      .get(`/admin/curriculum/items/${fixture.itemId}`)
      .set(auth)
      .expect(200);

    expect(archived.body.status).toBe('ARCHIVED');
  });

  it('recusa arquivar questão presa a uma lição no ar', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
      .set(auth)
      .send({ steps: steps(fixture) })
      .expect(200);
    await publish(fixture, fixture.versionId);

    const response = await http()
      .post(`/admin/curriculum/items/${fixture.itemId}/archive`)
      .set(auth)
      .expect(409);

    expect(response.body.error.code).toBe('ITEM_IN_USE');
    expect(response.body.error.details.lessons).toContain('nice-to-meet-you');
  });

  // -------------------------------------------------------------------
  // Taxonomia
  // -------------------------------------------------------------------

  it('não renomeia slug de taxonomia — deprecia e substitui', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.editor}` };

    await http()
      .post('/admin/curriculum/skills')
      .set(auth)
      .send({
        id: 'grammar.be.present.v2',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'A1',
        title: 'Verbo to be no presente (revisado)',
      })
      .expect(201);

    const deprecated = await http()
      .post('/admin/curriculum/skills/grammar.be.present.affirmative/deprecate')
      .set(auth)
      .send({ replacedById: 'grammar.be.present.v2' })
      .expect(201);

    expect(deprecated.body.deprecatedAt).not.toBeNull();
    expect(deprecated.body.replacedById).toBe('grammar.be.present.v2');

    // Descontinuada sai do catálogo do aluno, mas continua no banco.
    const catalog = await http()
      .get('/catalog/skills')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    const ids = catalog.body.data.map((skill: { id: string }) => skill.id);

    expect(ids).not.toContain('grammar.be.present.affirmative');
    expect(ids).toContain('grammar.be.present.v2');
  });

  it('recusa slug repetido', async () => {
    const editor = await tokenFor(Role.EDITOR);

    const payload = {
      id: 'chunk.nice-to-meet-you',
      type: 'CHUNK',
      competency: 'SPEAKING',
      cefrLevel: 'A1',
      title: 'Nice to meet you',
    };

    await http()
      .post('/admin/curriculum/skills')
      .set('Authorization', `Bearer ${editor}`)
      .send(payload)
      .expect(201);

    const response = await http()
      .post('/admin/curriculum/skills')
      .set('Authorization', `Bearer ${editor}`)
      .send(payload)
      .expect(409);

    expect(response.body.error.code).toBe('SLUG_IN_USE');
  });

  it('exige que a skill de uma nota de registro seja do tipo REGISTER', async () => {
    const fixture = await buildFixture();

    const response = await http()
      .post('/admin/curriculum/register-notes')
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({
        id: 'gonna',
        spokenForm: 'gonna',
        standardForm: 'going to',
        register: 'INFORMAL_SPOKEN',
        explanation: 'Forma falada de "going to".',
        cefrLevel: 'A2',
        skillId: 'grammar.be.present.affirmative',
      })
      .expect(422);

    expect(response.body.error.code).toBe('MISSING_REFERENCES');
  });

  // -------------------------------------------------------------------
  // Catálogo
  // -------------------------------------------------------------------

  it('lista níveis, unidades publicadas e notas de registro', async () => {
    const fixture = await buildFixture();
    const auth = { Authorization: `Bearer ${fixture.student}` };

    const levels = await http().get('/catalog/levels').set(auth).expect(200);

    expect(levels.body[0].cefrLevel).toBe('A1');
    expect(levels.body[0].objectives).toContain('Se apresentar');

    const units = await http().get('/catalog/units').set(auth).expect(200);

    expect(units.body.data).toHaveLength(1);
    expect(units.body.data[0].cast[0].slug).toBe('maya');

    await http()
      .post('/admin/curriculum/register-notes')
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({
        id: 'im-contraction',
        spokenForm: "I'm",
        standardForm: 'I am',
        register: 'INFORMAL_SPOKEN',
        explanation: 'Na fala é quase sempre a forma curta.',
        whenToAvoid: 'Não encurta em "Yes, I am".',
        cefrLevel: 'A1',
      })
      .expect(201);

    const notes = await http()
      .get('/catalog/register-notes?level=A1')
      .set(auth)
      .expect(200);

    expect(notes.body.data).toHaveLength(1);
    expect(notes.body.data[0].standardForm).toBe('I am');
  });

  it('não mostra unidade que ainda não foi publicada', async () => {
    const fixture = await buildFixture();

    await http()
      .post(`/admin/curriculum/units/${fixture.unitId}/transition`)
      .set('Authorization', `Bearer ${fixture.editor}`)
      .send({ action: 'archive' })
      .expect(201);

    const units = await http()
      .get('/catalog/units')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(units.body.data).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Autoria para o editor do admin: reordenar, rascunho tolerante, preview,
  // busca de skill e upload de imagem
  // -------------------------------------------------------------------

  describe('suporte ao editor', () => {
    const asEditor = (fixture: Fixture) => ({
      Authorization: `Bearer ${fixture.editor}`,
    });

    async function createLesson(
      fixture: Fixture,
      slug: string,
      order: number,
    ): Promise<string> {
      const response = await http()
        .post('/admin/curriculum/lessons')
        .set(asEditor(fixture))
        .send({
          unitId: fixture.unitId,
          slug,
          order,
          title: `Lição ${slug}`,
          objective: 'Se apresentar.',
          cefrLevel: 'A1',
        })
        .expect(201);

      return response.body.id as string;
    }

    it('reordena as lições da unidade sem esbarrar na unicidade', async () => {
      const fixture = await buildFixture();
      const second = await createLesson(fixture, 'second', 5);
      const third = await createLesson(fixture, 'third', 9);

      const response = await http()
        .post('/admin/curriculum/lessons/reorder')
        .set(asEditor(fixture))
        .send({
          unitId: fixture.unitId,
          ids: [third, fixture.lessonId, second],
        })
        .expect(201);

      expect(
        response.body.map((lesson: { id: string; order: number }) => [
          lesson.id,
          lesson.order,
        ]),
      ).toEqual([
        [third, 0],
        [fixture.lessonId, 1],
        [second, 2],
      ]);
    });

    it('recusa reordenar com lista que não bate com a unidade', async () => {
      const fixture = await buildFixture();
      const second = await createLesson(fixture, 'second', 1);

      const missing = await http()
        .post('/admin/curriculum/lessons/reorder')
        .set(asEditor(fixture))
        .send({ unitId: fixture.unitId, ids: [second] })
        .expect(422);

      expect(missing.body.error.code).toBe('REORDER_MISMATCH');
      expect(missing.body.error.details.missing).toEqual([fixture.lessonId]);

      await http()
        .post('/admin/curriculum/lessons/reorder')
        .set(asEditor(fixture))
        .send({
          unitId: fixture.unitId,
          ids: [second, second, fixture.lessonId],
        })
        .expect(422);

      // Nada mudou.
      const lessons = await http()
        .get(`/admin/curriculum/lessons?unitId=${fixture.unitId}`)
        .set(asEditor(fixture))
        .expect(200);

      expect(lessons.body.map((lesson: { id: string }) => lesson.id)).toEqual([
        fixture.lessonId,
        second,
      ]);
    });

    it('reordena as unidades do nível', async () => {
      const fixture = await buildFixture();
      const unit = await http()
        .get(`/admin/curriculum/units/${fixture.unitId}`)
        .set(asEditor(fixture))
        .expect(200);
      const levelId = unit.body.levelId as string;

      const other = await http()
        .post('/admin/curriculum/units')
        .set(asEditor(fixture))
        .send({ levelId, slug: 'a1-u2', order: 7, title: 'Episódio 2' })
        .expect(201);

      const response = await http()
        .post('/admin/curriculum/units/reorder')
        .set(asEditor(fixture))
        .send({ levelId, ids: [other.body.id, fixture.unitId] })
        .expect(201);

      expect(
        response.body.map((item: { id: string; order: number }) => [
          item.id,
          item.order,
        ]),
      ).toEqual([
        [other.body.id, 0],
        [fixture.unitId, 1],
      ]);

      await http()
        .post('/admin/curriculum/units/reorder')
        .set(asEditor(fixture))
        .send({ levelId, ids: [fixture.unitId] })
        .expect(422);
    });

    it('reordenar é coisa de editor: aluno recebe 403', async () => {
      const fixture = await buildFixture();

      await http()
        .post('/admin/curriculum/lessons/reorder')
        .set('Authorization', `Bearer ${fixture.student}`)
        .send({ unitId: fixture.unitId, ids: [fixture.lessonId] })
        .expect(403);
    });

    it('rascunho tolerante grava conteúdo incompleto e devolve os problemas', async () => {
      const fixture = await buildFixture();
      const url = `/admin/curriculum/lesson-versions/${fixture.versionId}/steps`;
      const broken = [
        {
          order: 0,
          type: 'SCENE',
          content: { location: 'Corredor', characterIds: [], lines: [] },
        },
      ];

      // Sem o parâmetro, a regra de sempre: recusa.
      await http()
        .put(url)
        .set(asEditor(fixture))
        .send({ steps: broken })
        .expect(422);

      const saved = await http()
        .put(`${url}?draft=true`)
        .set(asEditor(fixture))
        .send({ steps: broken })
        .expect(200);

      expect(saved.body.steps).toHaveLength(1);
      expect(saved.body.issues.length).toBeGreaterThan(0);
      expect(saved.body.issues[0]).toEqual(
        expect.objectContaining({ order: 0, path: expect.any(String) }),
      );

      // O que foi salvo volta como estava.
      const reread = await http()
        .get(`/admin/curriculum/lesson-versions/${fixture.versionId}`)
        .set(asEditor(fixture))
        .expect(200);

      expect(reread.body.steps[0].content.location).toBe('Corredor');
    });

    it('rascunho tolerante recusa só o que nem objeto é', async () => {
      const fixture = await buildFixture();

      const response = await http()
        .put(
          `/admin/curriculum/lesson-versions/${fixture.versionId}/steps?draft=true`,
        )
        .set(asEditor(fixture))
        .send({ steps: [{ order: 0, type: 'SCENE', content: 'texto' }] })
        .expect(422);

      expect(response.body.error.code).toBe('CONTENT_VALIDATION_FAILED');
    });

    it('mandar para revisão valida tudo: o rascunho quebrado não passa', async () => {
      const fixture = await buildFixture();
      const url = `/admin/curriculum/lesson-versions/${fixture.versionId}`;

      await http()
        .put(`${url}/steps?draft=true`)
        .set(asEditor(fixture))
        .send({
          steps: [{ order: 0, type: 'PRACTICE', content: { itemIds: [] } }],
        })
        .expect(200);

      const refused = await http()
        .post(`${url}/submit-for-review`)
        .set(asEditor(fixture))
        .expect(422);

      expect(refused.body.error.code).toBe('CONTENT_VALIDATION_FAILED');
      expect(refused.body.error.details.issues[0].order).toBe(0);

      const fixed = await http()
        .put(`${url}/steps?draft=true`)
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(200);

      expect(fixed.body.issues).toEqual([]);

      await http()
        .post(`${url}/submit-for-review`)
        .set(asEditor(fixture))
        .expect(201);
    });

    it('rascunho tolerante sobre versão aprovada devolve ela para rascunho', async () => {
      const fixture = await buildFixture();
      const url = `/admin/curriculum/lesson-versions/${fixture.versionId}`;

      await http()
        .put(`${url}/steps`)
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(200);
      await http()
        .post(`${url}/submit-for-review`)
        .set(asEditor(fixture))
        .expect(201);
      await http().post(`${url}/approve`).set(asEditor(fixture)).expect(201);

      const saved = await http()
        .put(`${url}/steps?draft=true`)
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(200);

      expect(saved.body.status).toBe('DRAFT');
      expect(saved.body.approvedAt).toBeNull();
    });

    it('versão publicada não aceita nem o rascunho tolerante', async () => {
      const fixture = await buildFixture();

      await http()
        .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(200);
      await publish(fixture, fixture.versionId);

      const response = await http()
        .put(
          `/admin/curriculum/lesson-versions/${fixture.versionId}/steps?draft=true`,
        )
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(409);

      expect(response.body.error.code).toBe('INVALID_CONTENT_TRANSITION');
    });

    it('preview de rascunho: o que o aluno veria, sem gabarito e com áudio assinado', async () => {
      const fixture = await buildFixture();

      await http()
        .put(`/admin/curriculum/lesson-versions/${fixture.versionId}/steps`)
        .set(asEditor(fixture))
        .send({ steps: steps(fixture) })
        .expect(200);

      const response = await http()
        .get(`/admin/curriculum/lesson-versions/${fixture.versionId}/preview`)
        .set(asEditor(fixture))
        .expect(200);

      expect(response.body.slug).toBe('nice-to-meet-you');
      expect(response.body.steps).toHaveLength(3);
      expect(response.body.items).toHaveLength(1);
      expect(JSON.stringify(response.body.items)).not.toContain(
        'correctOptionIds',
      );
      expect(response.body.assets[fixture.assetId].url).toEqual(
        expect.stringContaining('http'),
      );

      // O aluno continua sem ver nada: o rascunho não está publicado.
      await http()
        .get('/catalog/lessons/nice-to-meet-you')
        .set('Authorization', `Bearer ${fixture.student}`)
        .expect(404);
    });

    it('preview não quebra com conteúdo pela metade', async () => {
      const fixture = await buildFixture();

      await http()
        .put(
          `/admin/curriculum/lesson-versions/${fixture.versionId}/steps?draft=true`,
        )
        .set(asEditor(fixture))
        .send({
          steps: [
            { order: 0, type: 'SCENE', content: { location: 'x' } },
            {
              order: 1,
              type: 'PRACTICE',
              content: { itemIds: [fixture.itemId] },
            },
          ],
        })
        .expect(200);

      const response = await http()
        .get(`/admin/curriculum/lesson-versions/${fixture.versionId}/preview`)
        .set(asEditor(fixture))
        .expect(200);

      expect(response.body.steps).toHaveLength(2);
      // A etapa válida segue resolvendo o item.
      expect(response.body.items).toHaveLength(1);
    });

    it('preview de versão que não existe é 404; aluno recebe 403', async () => {
      const fixture = await buildFixture();
      const missing = '00000000-0000-4000-8000-000000000000';

      await http()
        .get(`/admin/curriculum/lesson-versions/${missing}/preview`)
        .set(asEditor(fixture))
        .expect(404);
      await http()
        .get(`/admin/curriculum/lesson-versions/${fixture.versionId}/preview`)
        .set('Authorization', `Bearer ${fixture.student}`)
        .expect(403);
    });

    it('busca de skill por texto ignora acento e caixa', async () => {
      const fixture = await buildFixture();

      await http()
        .post('/admin/curriculum/skills')
        .set(asEditor(fixture))
        .send({
          id: 'vocab.cafe',
          type: 'VOCAB_SET',
          competency: 'VOCABULARY',
          cefrLevel: 'A1',
          title: 'Pedir um café',
        })
        .expect(201);

      const find = async (q: string): Promise<string[]> => {
        const response = await http()
          .get(`/admin/curriculum/skills?q=${encodeURIComponent(q)}`)
          .set(asEditor(fixture))
          .expect(200);

        return response.body.data.map((skill: { id: string }) => skill.id);
      };

      expect(await find('CAFE')).toEqual(['vocab.cafe']);
      expect(await find('verbo presente')).toEqual([
        'grammar.be.present.affirmative',
      ]);
      expect(await find('grammar.be')).toEqual([
        'grammar.be.present.affirmative',
      ]);
      expect(await find('nada disso')).toEqual([]);
    });

    const PNG = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32, 1),
    ]);

    it('recebe a imagem do avatar e registra o asset', async () => {
      const fixture = await buildFixture();

      const response = await http()
        .post('/admin/curriculum/media-assets/upload')
        .set(asEditor(fixture))
        .attach('file', PNG, { filename: 'maya.png', contentType: 'image/png' })
        .expect(201);

      expect(response.body.kind).toBe('IMAGE');
      expect(response.body.mimeType).toBe('image/png');
      expect(response.body.storageKey).toMatch(/^content\/images\/.+\.png$/);
      expect(response.body.url).toEqual(expect.stringContaining('http'));

      // Mesmo arquivo, mesmo asset.
      const again = await http()
        .post('/admin/curriculum/media-assets/upload')
        .set(asEditor(fixture))
        .attach('file', PNG, {
          filename: 'outra.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(again.body.id).toBe(response.body.id);

      // E o personagem enxerga o avatar na listagem.
      const character = await http()
        .patch(`/admin/curriculum/characters/${fixture.characterId}`)
        .set(asEditor(fixture))
        .send({ avatarAssetId: response.body.id })
        .expect(200);

      expect(character.body.avatarAssetId).toBe(response.body.id);

      const list = await http()
        .get('/admin/curriculum/characters')
        .set(asEditor(fixture))
        .expect(200);

      expect(list.body[0].avatarUrl).toEqual(expect.stringContaining('http'));
    });

    it('recusa arquivo que não é imagem, mesmo com nome de imagem', async () => {
      const fixture = await buildFixture();

      const response = await http()
        .post('/admin/curriculum/media-assets/upload')
        .set(asEditor(fixture))
        .attach('file', Buffer.from('<svg></svg>'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(422);

      expect(response.body.error.code).toBe('INVALID_IMAGE');

      const none = await http()
        .post('/admin/curriculum/media-assets/upload')
        .set(asEditor(fixture))
        .expect(422);

      expect(none.body.error.code).toBe('INVALID_IMAGE');
    });

    it('recusa imagem acima de 2 MB', async () => {
      const fixture = await buildFixture();
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);

      const response = await http()
        .post('/admin/curriculum/media-assets/upload')
        .set(asEditor(fixture))
        .attach('file', big, {
          filename: 'grande.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(413);
    });

    it('upload é coisa de editor: aluno recebe 403', async () => {
      const fixture = await buildFixture();

      await http()
        .post('/admin/curriculum/media-assets/upload')
        .set('Authorization', `Bearer ${fixture.student}`)
        .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
        .expect(403);
    });
  });
});
