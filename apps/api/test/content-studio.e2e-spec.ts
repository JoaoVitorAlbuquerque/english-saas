import { ContentDraftStatus, Role } from '@prisma/client';
import request from 'supertest';

import { DraftGeneratorService } from 'src/modules/content-studio/services/draft-generator.service';
import { QaService } from 'src/modules/content-studio/services/qa.service';
import { TtsService } from 'src/modules/content-studio/services/tts.service';
import { WorkbookService } from 'src/modules/content-studio/services/workbook.service';

import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Fluxo do módulo 5: pedir rascunho → QA → revisar → aprovar (com áudio) →
 * publicar (com apostila).
 *
 * Os jobs são chamados direto pelos serviços em vez de esperar o worker: o
 * teste quer provar a lógica, não a latência do BullMQ, que já tem prova
 * própria em `queue.e2e-spec.ts`.
 */
describe('Content studio (e2e)', () => {
  let context: TestApp;
  let generator: DraftGeneratorService;
  let qa: QaService;
  let tts: TtsService;
  let workbooks: WorkbookService;

  beforeAll(async () => {
    context = await createTestApp();
    generator = context.app.get(DraftGeneratorService);
    qa = context.app.get(QaService);
    tts = context.app.get(TtsService);
    workbooks = context.app.get(WorkbookService);
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.flushAiCache();
    await context.resetRateLimit();
  });

  afterAll(async () => {
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function tokenFor(role: Role, email: string): Promise<string> {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name: `Usuário ${role}`,
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    if (role === Role.STUDENT) {
      return signup.body.accessToken as string;
    }

    await context.prisma.user.update({
      where: { id: signup.body.user.id as string },
      data: { role },
    });

    const signin = await http()
      .post('/auth/signin')
      .send({ email, password: PASSWORD })
      .expect(200);

    return signin.body.accessToken as string;
  }

  type Fixture = {
    editor: string;
    student: string;
    auth: { Authorization: string };
    unitId: string;
    characterIds: string[];
    skillId: string;
  };

  /** Taxonomia, curso, unidade publicada e dois personagens. */
  async function buildFixture(): Promise<Fixture> {
    const editor = await tokenFor(Role.EDITOR, 'editor@exemplo.com');
    const student = await tokenFor(Role.STUDENT, 'aluno@exemplo.com');
    const auth = { Authorization: `Bearer ${editor}` };

    await http()
      .post('/admin/curriculum/error-patterns')
      .set(auth)
      .send({
        id: 'l1.have-for-age',
        description: 'Usa "have" para idade.',
        example: 'I have 20 years.',
        correction: "I'm 20 years old.",
        explanation: 'Em inglês a idade vai com o verbo to be.',
      })
      .expect(201);

    await http()
      .post('/admin/curriculum/skills')
      .set(auth)
      .send({
        id: 'grammar.be.present.affirmative',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'A1',
        title: 'Verbo to be no presente',
      })
      .expect(201);

    await http()
      .post('/admin/curriculum/skills')
      .set(auth)
      .send({
        id: 'register.contracted-be',
        type: 'REGISTER',
        competency: 'LISTENING',
        cefrLevel: 'A1',
        title: 'Forma curta do to be',
      })
      .expect(201);

    await http()
      .post('/admin/curriculum/register-notes')
      .set(auth)
      .send({
        id: 'im-contraction',
        spokenForm: "I'm",
        standardForm: 'I am',
        register: 'INFORMAL_SPOKEN',
        explanation: 'Na fala é quase sempre a forma curta.',
        cefrLevel: 'A1',
        skillId: 'register.contracted-be',
      })
      .expect(201);

    const course = await http()
      .post('/admin/curriculum/courses')
      .set(auth)
      .send({ slug: 'english', title: 'Inglês' })
      .expect(201);

    const level = await http()
      .post('/admin/curriculum/levels')
      .set(auth)
      .send({
        courseId: course.body.id,
        cefrLevel: 'A1',
        title: 'A1',
        order: 0,
        objectives: ['Se apresentar'],
      })
      .expect(201);

    const characterIds: string[] = [];

    for (const slug of ['maya', 'lucas']) {
      const character = await http()
        .post('/admin/curriculum/characters')
        .set(auth)
        .send({ slug, name: slug === 'maya' ? 'Maya' : 'Lucas' })
        .expect(201);

      characterIds.push(character.body.id as string);
    }

    const unit = await http()
      .post('/admin/curriculum/units')
      .set(auth)
      .send({
        levelId: level.body.id,
        slug: 'a1-u1',
        order: 0,
        title: 'Episódio 1',
        characterIds,
      })
      .expect(201);

    for (const action of ['submit', 'approve', 'publish']) {
      await http()
        .post(`/admin/curriculum/units/${unit.body.id}/transition`)
        .set(auth)
        .send({ action })
        .expect(201);
    }

    return {
      editor,
      student,
      auth,
      unitId: unit.body.id as string,
      characterIds,
      skillId: 'grammar.be.present.affirmative',
    };
  }

  /** Pede o rascunho e roda o job na mão, sem esperar o worker. */
  async function draftLesson(fixture: Fixture): Promise<string> {
    const response = await http()
      .post('/admin/content-studio/drafts/lesson')
      .set(fixture.auth)
      .send({
        unitId: fixture.unitId,
        slug: 'nice-to-meet-you',
        order: 0,
        title: 'Nice to meet you',
        objective: 'Se apresentar e responder a apresentações.',
        level: 'A1',
        targetSkillIds: [fixture.skillId],
        characterIds: fixture.characterIds,
        unitContext: 'Primeira lição da série.',
      })
      .expect(202);

    const draftId = response.body.id as string;

    expect(response.body.status).toBe(ContentDraftStatus.QUEUED);

    await generator.generateLesson(draftId);

    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true },
    });

    await qa.run({
      draftId,
      lessonVersionId: draft.lessonVersionId!,
      level: 'A1',
    });

    return draftId;
  }

  // -------------------------------------------------------------------
  // Guard
  // -------------------------------------------------------------------

  it('recusa o estúdio para quem é aluno', async () => {
    const student = await tokenFor(Role.STUDENT, 'so-aluno@exemplo.com');

    const response = await http()
      .get('/admin/content-studio/drafts')
      .set('Authorization', `Bearer ${student}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // -------------------------------------------------------------------
  // Rascunho
  // -------------------------------------------------------------------

  it('gera a lição em DRAFT, com itens AI_DRAFT e avisos de QA', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);

    const draft = await http()
      .get(`/admin/content-studio/drafts/${draftId}`)
      .set(fixture.auth)
      .expect(200);

    expect(draft.body.status).toBe(ContentDraftStatus.READY);
    expect(draft.body.promptId).toBe('draft-lesson');
    expect(draft.body.promptVersion).toBe(1);
    expect(draft.body.lessonVersionId).not.toBeNull();
    expect(draft.body.createdItemIds).toHaveLength(8);

    // O relatório de QA acompanha o rascunho.
    const report = draft.body.qaReports[0];

    expect(report).toBeDefined();
    expect(report.levelStats.totalWords).toBeGreaterThan(0);

    // A versão nasceu em rascunho — nada chegou a aluno.
    const version = await http()
      .get(`/admin/curriculum/lesson-versions/${draft.body.lessonVersionId}`)
      .set(fixture.auth)
      .expect(200);

    expect(version.body.status).toBe('DRAFT');
    expect(
      version.body.steps.map((step: { type: string }) => step.type),
    ).toEqual([
      'SCENE',
      'EXPLANATION_CARDS',
      'PRACTICE',
      'FREE_PRODUCTION',
      'ROLEPLAY',
      'SUMMARY',
    ]);

    const items = await context.prisma.item.findMany({
      where: { id: { in: draft.body.createdItemIds as string[] } },
      select: { status: true, source: true },
    });

    expect(items.every((item) => item.status === 'DRAFT')).toBe(true);
    expect(items.every((item) => item.source === 'AI_DRAFT')).toBe(true);

    // O aluno não vê nada disso.
    await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(404);
  });

  it('as marcações da IA viram índices que caem no texto certo', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);

    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true },
    });

    const scene = await context.prisma.lessonStep.findFirstOrThrow({
      where: { lessonVersionId: draft.lessonVersionId!, type: 'SCENE' },
      select: { content: true },
    });

    const lines = (
      scene.content as unknown as {
        lines: {
          text: string;
          spans: { start: number; end: number }[];
        }[];
      }
    ).lines;

    const marked = lines.flatMap((line) =>
      line.spans.map((span) => line.text.slice(span.start, span.end)),
    );

    expect(marked.length).toBeGreaterThan(0);
    expect(marked).toContain('Are you new here?');
    expect(marked.every((text) => text.trim().length > 0)).toBe(true);
  });

  it('gera questões avulsas para uma skill', async () => {
    const fixture = await buildFixture();

    const response = await http()
      .post('/admin/content-studio/drafts/items')
      .set(fixture.auth)
      .send({
        skillId: fixture.skillId,
        level: 'A1',
        count: 4,
        types: ['MULTIPLE_CHOICE', 'FILL_BLANK'],
      })
      .expect(202);

    await generator.generateItems(response.body.id as string);

    const draft = await http()
      .get(`/admin/content-studio/drafts/${response.body.id}`)
      .set(fixture.auth)
      .expect(200);

    expect(draft.body.createdItemIds).toHaveLength(4);
    expect(draft.body.promptId).toBe('draft-items');
  });

  it('gera notas de registro sem repetir as que já existem', async () => {
    const fixture = await buildFixture();

    const response = await http()
      .post('/admin/content-studio/drafts/register-notes')
      .set(fixture.auth)
      .send({ level: 'A2', count: 2 })
      .expect(202);

    await generator.generateRegisterNotes(response.body.id as string);

    const draft = await http()
      .get(`/admin/content-studio/drafts/${response.body.id}`)
      .set(fixture.auth)
      .expect(200);

    expect(draft.body.status).toBe(ContentDraftStatus.READY);
    // "im-contraction" já existia e não pode voltar.
    expect(draft.body.createdRegisterNoteIds).not.toContain('im-contraction');
    expect(draft.body.createdRegisterNoteIds.length).toBeGreaterThan(0);
  });

  it('descarta o rascunho e arquiva o que ele criou', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);

    const discarded = await http()
      .post(`/admin/content-studio/drafts/${draftId}/discard`)
      .set(fixture.auth)
      .expect(201);

    expect(discarded.body.status).toBe(ContentDraftStatus.DISCARDED);

    const items = await context.prisma.item.findMany({
      where: { id: { in: discarded.body.createdItemIds as string[] } },
      select: { status: true },
    });

    expect(items.every((item) => item.status === 'ARCHIVED')).toBe(true);
  });

  // -------------------------------------------------------------------
  // QA
  // -------------------------------------------------------------------

  it('acusa palavra acima do nível sem alterar o conteúdo', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);
    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true },
    });

    const versionId = draft.lessonVersionId!;
    const scene = await context.prisma.lessonStep.findFirstOrThrow({
      where: { lessonVersionId: versionId, type: 'SCENE' },
      select: { id: true, content: true },
    });

    const content = scene.content as unknown as {
      lines: { text: string; spans: unknown[] }[];
    };
    const original = content.lines[0]!.text;

    content.lines[0]!.text = 'It is fine, albeit cold.';
    content.lines[0]!.spans = [];

    await context.prisma.lessonStep.update({
      where: { id: scene.id },
      data: { content: content as never },
    });

    const report = await http()
      .post(`/admin/content-studio/qa/lesson-versions/${versionId}`)
      .set(fixture.auth)
      .expect(201);

    const codes = (report.body.warnings as { code: string }[]).map(
      (w) => w.code,
    );

    expect(codes).toContain('LEVEL_ABOVE_TARGET');
    // A revisão linguística também acusou — e nenhuma das duas editou nada.
    expect(codes).toContain('LANGUAGE_ISSUE');

    const after = await context.prisma.lessonStep.findUniqueOrThrow({
      where: { id: scene.id },
      select: { content: true },
    });

    expect(
      (after.content as unknown as { lines: { text: string }[] }).lines[0]!
        .text,
    ).toBe('It is fine, albeit cold.');
    expect(original).not.toBe('It is fine, albeit cold.');
  });

  it('bloqueador da QA impede aprovar, aviso não', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);
    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true, createdItemIds: true },
    });

    const versionId = draft.lessonVersionId!;

    // Quebra um ORDER_WORDS: as peças deixam de montar a resposta.
    const broken = await context.prisma.item.findFirstOrThrow({
      where: { id: { in: draft.createdItemIds }, type: 'ORDER_WORDS' },
      select: { id: true },
    });

    await context.prisma.item.update({
      where: { id: broken.id },
      data: { content: { tokens: ['completely', 'different', 'words'] } },
    });

    await qa.run({ draftId, lessonVersionId: versionId, level: 'A1' });

    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/submit-for-review`)
      .set(fixture.auth)
      .expect(201);

    const refused = await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/approve`)
      .set(fixture.auth)
      .expect(409);

    expect(refused.body.error.code).toBe('QA_BLOCKERS');
    expect(refused.body.error.details.blockers[0].code).toBe(
      'ORDER_WORDS_TOKENS_MISMATCH',
    );
  });

  // -------------------------------------------------------------------
  // Revisão humana
  // -------------------------------------------------------------------

  it('comenta numa etapa, pede alterações e resolve', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);
    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true },
    });

    const versionId = draft.lessonVersionId!;

    const comment = await http()
      .post(`/admin/content-studio/lesson-versions/${versionId}/comments`)
      .set(fixture.auth)
      .send({
        target: 'STEP',
        targetRef: '0',
        body: 'A terceira fala está seca demais.',
      })
      .expect(201);

    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/submit-for-review`)
      .set(fixture.auth)
      .expect(201);

    // Pedir alterações é o `reject` do módulo 4.
    const rejected = await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/reject`)
      .set(fixture.auth)
      .expect(201);

    expect(rejected.body.status).toBe('DRAFT');

    const open = await http()
      .get(`/admin/content-studio/lesson-versions/${versionId}/comments`)
      .set(fixture.auth)
      .expect(200);

    expect(open.body).toHaveLength(1);

    await http()
      .post(`/admin/content-studio/comments/${comment.body.id}/resolve`)
      .set(fixture.auth)
      .expect(201);

    const after = await http()
      .get(`/admin/content-studio/lesson-versions/${versionId}/comments`)
      .set(fixture.auth)
      .expect(200);

    expect(after.body).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Aprovação, áudio e publicação
  // -------------------------------------------------------------------

  it('aprovar publica as questões e gera o áudio; publicar gera a apostila', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);
    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true, createdItemIds: true },
    });

    const versionId = draft.lessonVersionId!;

    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/submit-for-review`)
      .set(fixture.auth)
      .expect(201);

    const approved = await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/approve`)
      .set(fixture.auth)
      .expect(201);

    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.approvedById).not.toBeNull();

    // Aprovar a lição publica as questões dela e marca como revisadas.
    const items = await context.prisma.item.findMany({
      where: { id: { in: draft.createdItemIds } },
      select: { status: true, source: true },
    });

    expect(items.every((item) => item.status === 'PUBLISHED')).toBe(true);
    expect(items.every((item) => item.source === 'AI_DRAFT_REVIEWED')).toBe(
      true,
    );

    // Sem áudio, o publish é recusado.
    const refused = await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/publish`)
      .set(fixture.auth)
      .expect(409);

    expect(refused.body.error.code).toBe('MISSING_AUDIO');
    expect(refused.body.error.details.missing.length).toBeGreaterThan(0);

    const first = await tts.generateForVersion(versionId);

    expect(first.generated).toBeGreaterThan(0);
    expect(first.reused).toBe(0);

    // Áudio de verdade no bucket: WAV válido gerado pelo FakeTts.
    const asset = await context.prisma.mediaAsset.findFirstOrThrow({
      where: { kind: 'AUDIO', storageKey: { contains: 'content/audio/fake' } },
      select: { storageKey: true, durationMs: true, sizeBytes: true },
    });

    expect(asset.durationMs).toBeGreaterThan(0);
    expect(asset.sizeBytes).toBeGreaterThan(44);

    const published = await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/publish`)
      .set(fixture.auth)
      .expect(201);

    expect(published.body.status).toBe('PUBLISHED');

    await workbooks.generateForUnit(fixture.unitId);

    const workbook = await context.prisma.workbook.findFirstOrThrow({
      where: { unitId: fixture.unitId },
      select: {
        status: true,
        generatedAt: true,
        sourceHash: true,
        asset: { select: { mimeType: true, sizeBytes: true } },
      },
    });

    expect(workbook.status).toBe('PUBLISHED');
    expect(workbook.generatedAt).not.toBeNull();
    expect(workbook.asset.mimeType).toBe('application/pdf');
    expect(workbook.asset.sizeBytes).toBeGreaterThan(1_000);

    // O aluno finalmente vê a lição, com áudio assinado e sem gabarito.
    const lesson = await http()
      .get('/catalog/lessons/nice-to-meet-you')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(lesson.body.items).toHaveLength(8);
    expect(Object.keys(lesson.body.assets).length).toBeGreaterThan(0);
    expect(JSON.stringify(lesson.body)).not.toContain('correctOptionIds');
    expect(JSON.stringify(lesson.body)).not.toContain('audioText');

    const workbooksResponse = await http()
      .get('/catalog/workbooks?level=A1')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(200);

    expect(workbooksResponse.body).toHaveLength(1);
    expect(workbooksResponse.body[0].file.url).toContain('X-Amz-Signature');
  }, 120_000);

  it('reaproveita o áudio pelo hash em vez de sintetizar de novo', async () => {
    const fixture = await buildFixture();
    const draftId = await draftLesson(fixture);
    const draft = await context.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { lessonVersionId: true },
    });

    const versionId = draft.lessonVersionId!;

    const first = await tts.generateForVersion(versionId);

    expect(first.generated).toBeGreaterThan(0);

    // Apaga o vínculo, mantendo as renditions: a segunda passada tem que
    // achar tudo pelo hash.
    const scene = await context.prisma.lessonStep.findFirstOrThrow({
      where: { lessonVersionId: versionId, type: 'SCENE' },
      select: { id: true, content: true },
    });

    const content = scene.content as unknown as {
      lines: Record<string, unknown>[];
    };

    for (const line of content.lines) {
      delete line['audioAssetId'];
    }

    await context.prisma.lessonStep.update({
      where: { id: scene.id },
      data: { content: content as never },
    });

    const second = await tts.generateForVersion(versionId);

    expect(second.generated).toBe(0);
    expect(second.reused).toBe(content.lines.length);
  }, 60_000);
});
