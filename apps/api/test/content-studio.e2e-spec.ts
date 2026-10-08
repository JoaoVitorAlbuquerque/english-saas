import { getQueueToken } from '@nestjs/bullmq';
import { ContentDraftStatus, Role } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { QUEUES } from 'src/infra/queue/queues';
import { CONTENT_GATE, type ContentGate } from 'src/common/access/content-gate';
import { QaService } from 'src/modules/content-studio/services/qa.service';
import { TtsService } from 'src/modules/content-studio/services/tts.service';

import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Fluxo do módulo 5: pedir rascunho → QA → revisar → aprovar (com áudio) →
 * publicar (com apostila).
 *
 * **Os workers estão de pé no e2e** (ver `setup-e2e.ts`), então o job roda
 * sozinho assim que o endpoint enfileira. O teste espera o resultado em vez
 * de chamar o serviço na mão — chamar geraria tudo duas vezes.
 */
describe('Content studio (e2e)', () => {
  let context: TestApp;
  let qa: QaService;
  let tts: TtsService;
  let gate: ContentGate;
  let draftsQueue: Queue;
  let qaQueue: Queue;
  let mediaQueue: Queue;

  beforeAll(async () => {
    context = await createTestApp();
    qa = context.app.get(QaService);
    tts = context.app.get(TtsService);
    gate = context.app.get<ContentGate>(CONTENT_GATE);
    draftsQueue = context.app.get<Queue>(getQueueToken(QUEUES.CONTENT_DRAFTS));
    qaQueue = context.app.get<Queue>(getQueueToken(QUEUES.CONTENT_QA));
    mediaQueue = context.app.get<Queue>(getQueueToken(QUEUES.MEDIA));
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.flushAiCache();
    await context.resetRateLimit();
  });

  afterAll(async () => {
    // Job pendente de uma suíte vaza para a seguinte e falha com dados que
    // já foram truncados. O `?.` é para uma falha de boot no `beforeAll`
    // não virar um erro aqui que esconde a causa de verdade.
    for (const queue of [draftsQueue, qaQueue, mediaQueue]) {
      await queue?.obliterate({ force: true });
    }

    await context?.close();
  });

  /** Espera uma condição do banco, que é onde o worker deixa o resultado. */
  async function waitFor<T>(
    read: () => Promise<T | null>,
    what: string,
    timeoutMs = 60_000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const value = await read();

      if (value !== null) {
        return value;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Esperei ${what} por ${String(timeoutMs)}ms e não veio.`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  /** Espera o rascunho chegar a READY. Falha rápido se ele der FAILED. */
  async function waitForDraft(draftId: string) {
    return waitFor(async () => {
      const draft = await context.prisma.contentDraft.findUniqueOrThrow({
        where: { id: draftId },
        select: {
          status: true,
          errorCode: true,
          lessonVersionId: true,
          createdItemIds: true,
          createdRegisterNoteIds: true,
        },
      });

      if (draft.status === ContentDraftStatus.FAILED) {
        throw new Error(`O rascunho falhou: ${String(draft.errorCode)}`);
      }

      return draft.status === ContentDraftStatus.READY ? draft : null;
    }, `o rascunho ${draftId} ficar pronto`);
  }

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

  /** Pede o rascunho e espera o worker gerar e passar pela QA. */
  async function draftLesson(
    fixture: Fixture,
  ): Promise<{ draftId: string; versionId: string; itemIds: string[] }> {
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
    const draft = await waitForDraft(draftId);

    expect(draft.lessonVersionId).not.toBeNull();

    return {
      draftId,
      versionId: draft.lessonVersionId as string,
      itemIds: draft.createdItemIds,
    };
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
    const { draftId } = await draftLesson(fixture);

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
    const { versionId } = await draftLesson(fixture);

    const scene = await context.prisma.lessonStep.findFirstOrThrow({
      where: { lessonVersionId: versionId, type: 'SCENE' },
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

    await waitForDraft(response.body.id as string);

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

    await waitForDraft(response.body.id as string);

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
    const { draftId } = await draftLesson(fixture);

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

  it('vê a palavra acima do nível e a revisa sem alterar o conteúdo', async () => {
    const fixture = await buildFixture();
    const { versionId } = await draftLesson(fixture);
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

    // A checagem de nível enxergou a palavra C1 e a reportou.
    const stats = report.body.levelStats as {
      outOfLevel: { word: string; band: string }[];
    };

    expect(stats.outOfLevel).toContainEqual({ word: 'albeit', band: 'C1' });

    // Mas **não** vira aviso: o teto de 5% é sobre a lição inteira, e uma
    // palavra difícil em ~200 não chega lá. É o comportamento certo — um
    // termo fora do nível, bem contextualizado, é permitido de propósito.
    const codes = (report.body.warnings as { code: string }[]).map(
      (w) => w.code,
    );

    expect(codes).not.toContain('LEVEL_ABOVE_TARGET');
    // Quem acusou foi a revisão linguística.
    expect(codes).toContain('LANGUAGE_ISSUE');

    // E nenhuma das duas encostou no conteúdo.
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
    const { draftId, versionId, itemIds } = await draftLesson(fixture);

    // Quebra um ORDER_WORDS: as peças deixam de montar a resposta.
    const broken = await context.prisma.item.findFirstOrThrow({
      where: { id: { in: itemIds }, type: 'ORDER_WORDS' },
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
    const { versionId } = await draftLesson(fixture);

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

  it('recusa publicar enquanto falta áudio', async () => {
    const fixture = await buildFixture();
    const { versionId } = await draftLesson(fixture);

    // Direto no gate: depois do approve o worker já estaria sintetizando, e
    // o teste viraria uma corrida contra ele.
    await expect(gate.assertCanPublish(versionId)).rejects.toMatchObject({
      code: 'MISSING_AUDIO',
    });
  });

  it('aprovar publica as questões e gera o áudio; publicar gera a apostila', async () => {
    const fixture = await buildFixture();
    const { versionId, itemIds } = await draftLesson(fixture);

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
      where: { id: { in: itemIds } },
      select: { status: true, source: true },
    });

    expect(items.every((item) => item.status === 'PUBLISHED')).toBe(true);
    expect(items.every((item) => item.source === 'AI_DRAFT_REVIEWED')).toBe(
      true,
    );

    // O listener enfileirou a narração na aprovação; o worker a executa.
    await waitFor(
      async () =>
        (await tts.pendingAudio(versionId)).length === 0 ? true : null,
      'a narração terminar',
    );

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

    // Publicar enfileira a apostila; o worker gera o PDF.
    const workbook = await waitFor(
      () =>
        context.prisma.workbook.findFirst({
          where: { unitId: fixture.unitId },
          select: {
            status: true,
            generatedAt: true,
            sourceHash: true,
            asset: { select: { mimeType: true, sizeBytes: true } },
          },
        }),
      'a apostila em PDF',
    );

    expect(workbook.status).toBe('PUBLISHED');
    expect(workbook.generatedAt).not.toBeNull();
    expect(workbook.sourceHash).not.toBeNull();
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
  }, 180_000);

  it('reaproveita o áudio pelo hash em vez de sintetizar de novo', async () => {
    const fixture = await buildFixture();
    const { versionId } = await draftLesson(fixture);

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

  // -------------------------------------------------------------------
  // Estúdio no admin: estimativa, ordem da fila, áudio e apostilas
  // -------------------------------------------------------------------

  it('lista os rascunhos do mais novo para o mais antigo', async () => {
    const fixture = await buildFixture();

    const first = await http()
      .post('/admin/content-studio/drafts/register-notes')
      .set(fixture.auth)
      .send({ level: 'A1', count: 2 })
      .expect(202);

    await waitForDraft(first.body.id as string);

    const second = await http()
      .post('/admin/content-studio/drafts/items')
      .set(fixture.auth)
      .send({ skillId: fixture.skillId, level: 'A1', count: 2 })
      .expect(202);

    await waitForDraft(second.body.id as string);

    const list = await http()
      .get('/admin/content-studio/drafts')
      .set(fixture.auth)
      .expect(200);

    expect(list.body.data.map((draft: { id: string }) => draft.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);
    expect(list.body.data[0].requestedBy.name).toBeDefined();
  });

  it('estima o custo pela média dos prontos do mesmo tipo', async () => {
    const fixture = await buildFixture();

    // Sem histórico, não há número (e o provedor fake cobra 0).
    const empty = await http()
      .get('/admin/content-studio/drafts/estimate?kind=LESSON')
      .set(fixture.auth)
      .expect(200);

    expect(empty.body).toEqual({ usdMicros: null, basedOn: 0 });

    const { draftId } = await draftLesson(fixture);

    await context.prisma.contentDraft.update({
      where: { id: draftId },
      data: { costUsdMicros: 40_000 },
    });

    const lesson = await http()
      .get('/admin/content-studio/drafts/estimate?kind=LESSON')
      .set(fixture.auth)
      .expect(200);

    expect(lesson.body).toEqual({ usdMicros: 40_000, basedOn: 1 });

    // Outro tipo de pedido não herda a média da lição.
    const items = await http()
      .get('/admin/content-studio/drafts/estimate?kind=ITEMS&count=5')
      .set(fixture.auth)
      .expect(200);

    expect(items.body.usdMicros).toBeNull();

    await http()
      .get('/admin/content-studio/drafts/estimate?kind=ITEMS&count=99')
      .set(fixture.auth)
      .expect(400);

    await http()
      .get('/admin/content-studio/drafts/estimate?kind=LESSON')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(403);
  });

  /** Envia, aprova e espera a narração da aprovação terminar. */
  async function approveAndNarrate(fixture: Fixture, versionId: string) {
    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/submit-for-review`)
      .set(fixture.auth)
      .expect(201);

    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/approve`)
      .set(fixture.auth)
      .expect(201);

    await waitFor(
      async () =>
        (await tts.pendingAudio(versionId)).length === 0 ? true : null,
      'a narração terminar',
    );
  }

  it('revisão de áudio: lista as falas, marca problema e gera de novo', async () => {
    const fixture = await buildFixture();
    const { versionId } = await draftLesson(fixture);
    const base = `/admin/content-studio/lesson-versions/${versionId}`;

    // Antes de aprovar: tudo sem áudio, e gerar de novo é recusado.
    const before = await http()
      .get(`${base}/audio`)
      .set(fixture.auth)
      .expect(200);

    expect(before.body.total).toBeGreaterThan(0);
    expect(before.body.pending).toBe(before.body.total);
    expect(before.body.targets[0].audio).toBeNull();

    const early = await http()
      .post(`${base}/audio/regenerate`)
      .set(fixture.auth)
      .send({ keys: [before.body.targets[0].key] })
      .expect(409);

    expect(early.body.error.code).toBe('AUDIO_REGENERATION_NOT_ALLOWED');

    await approveAndNarrate(fixture, versionId);

    const after = await http()
      .get(`${base}/audio`)
      .set(fixture.auth)
      .expect(200);

    expect(after.body.pending).toBe(0);
    expect(after.body.versionStatus).toBe('APPROVED');

    const line = after.body.targets.find(
      (target: { kind: string }) => target.kind === 'SCENE_LINE',
    );

    expect(line.key).toBe('scene:0:0');
    expect(line.label).toMatch(/Maya|Lucas/);
    expect(line.audio.url).toContain('X-Amz-Signature');
    expect(line.audio.durationMs).toBeGreaterThan(0);

    // Problema de áudio é um comentário de alvo AUDIO: exige tipo e chave válida.
    const noKind = await http()
      .post(`${base}/comments`)
      .set(fixture.auth)
      .send({ target: 'AUDIO', targetRef: line.key, body: '' })
      .expect(400);

    expect(JSON.stringify(noKind.body)).toContain('audioIssue');

    await http()
      .post(`${base}/comments`)
      .set(fixture.auth)
      .send({ target: 'AUDIO', targetRef: 'banana', audioIssue: 'SPEED' })
      .expect(400);

    const problem = await http()
      .post(`${base}/comments`)
      .set(fixture.auth)
      .send({
        target: 'AUDIO',
        targetRef: line.key,
        audioIssue: 'INTONATION',
        body: 'Soa como afirmação, é pergunta.',
      })
      .expect(201);

    expect(problem.body.audioIssue).toBe('INTONATION');

    const flagged = await http()
      .get(`${base}/audio`)
      .set(fixture.auth)
      .expect(200);
    const flaggedLine = flagged.body.targets.find(
      (target: { key: string }) => target.key === line.key,
    );

    expect(flaggedLine.openIssues).toHaveLength(1);
    expect(flaggedLine.openIssues[0].audioIssue).toBe('INTONATION');

    // O texto livre continua obrigatório nos outros alvos.
    await http()
      .post(`${base}/comments`)
      .set(fixture.auth)
      .send({ target: 'STEP', targetRef: '0', body: '' })
      .expect(400);

    // Nova geração: chave inexistente é 422; a boa troca o áudio da fala.
    await http()
      .post(`${base}/audio/regenerate`)
      .set(fixture.auth)
      .send({ keys: ['scene:9:9'] })
      .expect(422);

    const assetOf = async () => {
      const scene = await context.prisma.lessonStep.findFirstOrThrow({
        where: { lessonVersionId: versionId, type: 'SCENE' },
        select: { content: true },
      });

      return (
        scene.content as unknown as { lines: { audioAssetId?: string }[] }
      ).lines[0]?.audioAssetId;
    };
    const oldAsset = await assetOf();

    const regenerated = await http()
      .post(`${base}/audio/regenerate`)
      .set(fixture.auth)
      .send({ keys: [line.key], speakingRate: 0.8 })
      .expect(202);

    expect(regenerated.body.queue).toBe('media');

    const newAsset = await waitFor(async () => {
      const current = await assetOf();

      return current !== undefined && current !== oldAsset ? current : null;
    }, 'a fala ser gerada de novo');

    expect(newAsset).not.toBe(oldAsset);

    // A versão segue aprovada e com todos os áudios: dá para publicar.
    expect((await tts.pendingAudio(versionId)).length).toBe(0);
    await expect(gate.assertCanPublish(versionId)).resolves.toBeUndefined();

    const status = await http()
      .get(`/admin/curriculum/lesson-versions/${versionId}`)
      .set(fixture.auth)
      .expect(200);

    expect(status.body.status).toBe('APPROVED');
  }, 180_000);

  it('apostilas: lista por unidade, acusa desatualizada e acompanha o job', async () => {
    const fixture = await buildFixture();
    const { versionId } = await draftLesson(fixture);

    // Unidade sem lição publicada: aparece, sem apostila.
    const none = await http()
      .get('/admin/content-studio/workbooks')
      .set(fixture.auth)
      .expect(200);

    expect(none.body).toHaveLength(1);
    expect(none.body[0]).toMatchObject({
      cefrLevel: 'A1',
      publishedLessons: 0,
      workbook: null,
    });

    await approveAndNarrate(fixture, versionId);
    await http()
      .post(`/admin/curriculum/lesson-versions/${versionId}/publish`)
      .set(fixture.auth)
      .expect(201);

    const ready = await waitFor(async () => {
      const list = await http()
        .get('/admin/content-studio/workbooks')
        .set(fixture.auth)
        .expect(200);

      return list.body[0].workbook === null ? null : list.body[0];
    }, 'a apostila aparecer na lista');

    expect(ready.publishedLessons).toBe(1);
    expect(ready.workbook.stale).toBe(false);
    expect(ready.workbook.url).toContain('X-Amz-Signature');
    expect(ready.workbook.sizeBytes).toBeGreaterThan(1_000);

    // O conteúdo publicado mudou depois do PDF: a apostila está velha.
    await context.prisma.lessonVersion.update({
      where: { id: versionId },
      data: { title: 'Outro título' },
    });

    const stale = await http()
      .get('/admin/content-studio/workbooks')
      .set(fixture.auth)
      .expect(200);

    expect(stale.body[0].workbook.stale).toBe(true);

    // Regerar devolve o job, e o estado dele é consultável.
    const job = await http()
      .post(`/admin/content-studio/units/${fixture.unitId}/workbook`)
      .set(fixture.auth)
      .expect(202);

    const state = await http()
      .get(`/admin/content-studio/jobs/${String(job.body.jobId)}`)
      .set(fixture.auth)
      .expect(200);

    expect(['waiting', 'active', 'completed', 'unknown']).toContain(
      state.body.state,
    );

    await waitFor(async () => {
      const list = await http()
        .get('/admin/content-studio/workbooks')
        .set(fixture.auth)
        .expect(200);

      return list.body[0].workbook.stale === false ? true : null;
    }, 'a apostila ser regerada');

    await http()
      .get('/admin/content-studio/workbooks')
      .set('Authorization', `Bearer ${fixture.student}`)
      .expect(403);
  }, 180_000);
});
