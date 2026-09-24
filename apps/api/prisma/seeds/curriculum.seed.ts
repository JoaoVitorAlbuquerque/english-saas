import {
  ContentStatus,
  type LessonStepType,
  type MediaKind,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

import { buildSeedItems, LESSON_ITEM_SLUGS } from './curriculum/items';
import { buildLessonSteps } from './curriculum/lesson';
import {
  SEED_ERROR_PATTERNS,
  SEED_REGISTER_NOTES,
  SEED_SKILLS,
} from './curriculum/taxonomy';
import type { SeedModule } from './seed-module';

/**
 * Conteúdo base do A1.
 *
 * Cria a taxonomia, o curso com os cinco níveis, a unidade 1 com o elenco
 * fixo, as 20 questões e a lição "Nice to meet you" já publicada.
 *
 * **Os áudios não existem no bucket.** As linhas de `media_assets` apontam
 * para chaves sob `content/`, e a URL assinada é gerada normalmente — o
 * objeto é que ainda não está lá. Quem grava é o módulo 5, com o TTS.
 */

const CHARACTERS = [
  {
    slug: 'lucas',
    name: 'Lucas',
    voiceId: 'pt-br-male-01',
    bio: 'Brasileiro, 24 anos, de Campinas. Acabou de se mudar para Austin e está começando a vida lá.',
  },
  {
    slug: 'maya',
    name: 'Maya',
    voiceId: 'en-us-female-01',
    bio: 'Vizinha do 4B, nascida no Texas. Simpática, fala rápido e usa muita forma curta.',
  },
  {
    slug: 'biscuit',
    name: 'Biscuit',
    voiceId: null,
    bio: 'O cachorro da Maya. Não fala inglês, mas está em quase toda cena.',
  },
];

const LEVELS = [
  {
    cefrLevel: 'A1' as const,
    title: 'A1 — Iniciante',
    description: 'Do zero até se virar em situações simples do dia a dia.',
    objectives: [
      'Se apresentar e apresentar outra pessoa',
      'Falar de onde você é e onde mora',
      'Falar da sua rotina no presente simples',
      'Pedir comida e bebida num lugar simples',
      'Entender frases curtas ditas devagar',
    ],
  },
  {
    cefrLevel: 'A2' as const,
    title: 'A2 — Básico',
    description: 'Conversas do cotidiano sobre assuntos conhecidos.',
    objectives: [
      'Contar o que aconteceu no passado',
      'Fazer planos e combinar horário',
      'Descrever pessoas, lugares e experiências',
    ],
  },
  {
    cefrLevel: 'B1' as const,
    title: 'B1 — Intermediário',
    description: 'Se virar sozinho numa viagem e no trabalho.',
    objectives: [
      'Explicar uma opinião e dar motivos',
      'Lidar com imprevisto de viagem',
      'Acompanhar conversa sobre assunto conhecido',
    ],
  },
  {
    cefrLevel: 'B2' as const,
    title: 'B2 — Intermediário avançado',
    description: 'Discutir assuntos abstratos com naturalidade.',
    objectives: [
      'Defender um ponto de vista com argumento',
      'Entender série e podcast sem legenda',
      'Escrever texto claro sobre vários assuntos',
    ],
  },
  {
    cefrLevel: 'C1' as const,
    title: 'C1 — Avançado',
    description: 'Uso flexível e preciso, inclusive em contexto profissional.',
    objectives: [
      'Se expressar sem procurar palavra',
      'Entender texto longo e implícito',
      'Usar o registro certo para cada situação',
    ],
  },
];

/** Chave de storage → tipo e metadados do asset. */
const ASSETS: {
  key: string;
  storageKey: string;
  kind: MediaKind;
  mimeType: string;
  durationMs: number | null;
}[] = [
  ...['full', '1', '2', '3', '4', '5', '6', '7', '8'].map((part) => ({
    key: part === 'full' ? 'scene-full' : `scene-line-${part}`,
    storageKey: `content/lessons/nice-to-meet-you/scene-${part}.mp3`,
    kind: 'AUDIO' as MediaKind,
    mimeType: 'audio/mpeg',
    durationMs: part === 'full' ? 42_000 : 3_000,
  })),
  {
    key: 'item-hes-friendly',
    storageKey: 'content/items/a1-listen-hes-friendly.mp3',
    kind: 'AUDIO',
    mimeType: 'audio/mpeg',
    durationMs: 2_000,
  },
  {
    key: 'item-dictation',
    storageKey: 'content/items/a1-dictation-im-from-brazil.mp3',
    kind: 'AUDIO',
    mimeType: 'audio/mpeg',
    durationMs: 2_500,
  },
  {
    key: 'unit-cover',
    storageKey: 'content/units/a1-u1-new-neighbors/cover.webp',
    kind: 'IMAGE',
    mimeType: 'image/webp',
    durationMs: null,
  },
  ...CHARACTERS.map((character) => ({
    key: `avatar-${character.slug}`,
    storageKey: `content/characters/${character.slug}/avatar.webp`,
    kind: 'IMAGE' as MediaKind,
    mimeType: 'image/webp',
    durationMs: null,
  })),
];

export const curriculumSeed: SeedModule = {
  name: '4 curriculum',
  async run(prisma: PrismaClient): Promise<void> {
    const assets = await seedAssets(prisma);
    await seedTaxonomy(prisma);
    const characters = await seedCharacters(prisma, assets);
    const unit = await seedStructure(prisma, assets, characters);
    const items = await seedItems(prisma, assets);
    await seedLesson(prisma, {
      unitId: unit,
      characters,
      audio: assets,
      items,
    });

    console.warn(
      `Seed: ${String(SEED_SKILLS.length)} skills, ${String(
        SEED_ERROR_PATTERNS.length,
      )} erros típicos, ${String(
        SEED_REGISTER_NOTES.length,
      )} notas de registro, ${String(
        Object.keys(items).length,
      )} questões e a lição "Nice to meet you" publicada.`,
    );
  },
};

// ---------------------------------------------------------------------------

async function seedAssets(
  prisma: PrismaClient,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const asset of ASSETS) {
    const row = await prisma.mediaAsset.upsert({
      where: { storageKey: asset.storageKey },
      create: {
        kind: asset.kind,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        durationMs: asset.durationMs,
        // O arquivo ainda não existe no bucket — ver o comentário do topo.
        meta: { placeholder: true },
      },
      update: { mimeType: asset.mimeType, durationMs: asset.durationMs },
      select: { id: true },
    });

    map[asset.key] = row.id;
  }

  return map;
}

async function seedTaxonomy(prisma: PrismaClient): Promise<void> {
  for (const pattern of SEED_ERROR_PATTERNS) {
    await prisma.errorPattern.upsert({
      where: { id: pattern.id },
      create: pattern,
      update: {
        description: pattern.description,
        example: pattern.example,
        correction: pattern.correction,
        explanation: pattern.explanation,
      },
    });
  }

  // Duas passadas: a segunda liga pré-requisitos, que podem apontar para
  // uma skill criada depois.
  for (const skill of SEED_SKILLS) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      create: {
        id: skill.id,
        type: skill.type,
        competency: skill.competency,
        cefrLevel: skill.cefrLevel,
        title: skill.title,
        description: skill.description,
      },
      update: { title: skill.title, description: skill.description },
    });
  }

  for (const skill of SEED_SKILLS) {
    for (const prerequisiteId of skill.prerequisites ?? []) {
      await prisma.skillPrerequisite.upsert({
        where: {
          skillId_prerequisiteId: { skillId: skill.id, prerequisiteId },
        },
        create: { skillId: skill.id, prerequisiteId },
        update: {},
      });
    }

    for (const errorPatternId of skill.commonErrors ?? []) {
      await prisma.skillErrorPattern.upsert({
        where: {
          skillId_errorPatternId: { skillId: skill.id, errorPatternId },
        },
        create: { skillId: skill.id, errorPatternId },
        update: {},
      });
    }
  }

  for (const note of SEED_REGISTER_NOTES) {
    await prisma.registerNote.upsert({
      where: { id: note.id },
      create: note,
      update: {
        spokenForm: note.spokenForm,
        standardForm: note.standardForm,
        register: note.register,
        explanation: note.explanation,
        whenToAvoid: note.whenToAvoid,
        cefrLevel: note.cefrLevel,
        skillId: note.skillId,
      },
    });
  }
}

async function seedCharacters(
  prisma: PrismaClient,
  assets: Record<string, string>,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const character of CHARACTERS) {
    const row = await prisma.character.upsert({
      where: { slug: character.slug },
      create: {
        slug: character.slug,
        name: character.name,
        bio: character.bio,
        voiceId: character.voiceId,
        avatarAssetId: assets[`avatar-${character.slug}`] ?? null,
      },
      update: {
        name: character.name,
        bio: character.bio,
        voiceId: character.voiceId,
        avatarAssetId: assets[`avatar-${character.slug}`] ?? null,
      },
      select: { id: true },
    });

    map[character.slug] = row.id;
  }

  return map;
}

async function seedStructure(
  prisma: PrismaClient,
  assets: Record<string, string>,
  characters: Record<string, string>,
): Promise<string> {
  const course = await prisma.course.upsert({
    where: { slug: 'english' },
    create: {
      slug: 'english',
      language: 'en',
      title: 'Inglês do zero ao avançado',
      description:
        'Curso completo de inglês para brasileiros, do A1 ao C1, em formato de série.',
    },
    update: {},
    select: { id: true },
  });

  const levels: Record<string, string> = {};

  for (const [index, level] of LEVELS.entries()) {
    const row = await prisma.level.upsert({
      where: {
        courseId_cefrLevel: {
          courseId: course.id,
          cefrLevel: level.cefrLevel,
        },
      },
      create: {
        courseId: course.id,
        cefrLevel: level.cefrLevel,
        title: level.title,
        description: level.description,
        objectives: level.objectives,
        order: index,
      },
      update: {
        title: level.title,
        description: level.description,
        objectives: level.objectives,
        order: index,
      },
      select: { id: true },
    });

    levels[level.cefrLevel] = row.id;
  }

  const unit = await prisma.unit.upsert({
    where: { slug: 'a1-u1-new-neighbors' },
    create: {
      levelId: levels['A1'] ?? '',
      slug: 'a1-u1-new-neighbors',
      order: 0,
      title: 'Episódio 1 — Vizinhos novos',
      synopsis:
        'Lucas se muda para Austin e conhece a vizinha Maya. Nesta unidade você aprende a se apresentar e a falar de onde você é.',
      coverAssetId: assets['unit-cover'] ?? null,
      status: ContentStatus.PUBLISHED,
    },
    update: {
      title: 'Episódio 1 — Vizinhos novos',
      status: ContentStatus.PUBLISHED,
      coverAssetId: assets['unit-cover'] ?? null,
    },
    select: { id: true },
  });

  for (const characterId of Object.values(characters)) {
    await prisma.unitCharacter.upsert({
      where: { unitId_characterId: { unitId: unit.id, characterId } },
      create: { unitId: unit.id, characterId },
      update: {},
    });
  }

  return unit.id;
}

async function seedItems(
  prisma: PrismaClient,
  assets: Record<string, string>,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const item of buildSeedItems(assets)) {
    const row = await prisma.item.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        type: item.type,
        prompt: item.prompt,
        content: item.content as Prisma.InputJsonValue,
        acceptedAnswers: item.acceptedAnswers ?? [],
        explanation: item.explanation,
        errorPatternMap: (item.errorPatternMap ?? {}) as Prisma.InputJsonValue,
        cefrLevel: item.cefrLevel,
        // A1 = -2 na escala logit. A calibração real vem das tentativas.
        difficulty: -2,
        status: ContentStatus.PUBLISHED,
        source: 'HUMAN',
      },
      update: {
        prompt: item.prompt,
        content: item.content as Prisma.InputJsonValue,
        acceptedAnswers: item.acceptedAnswers ?? [],
        explanation: item.explanation,
        errorPatternMap: (item.errorPatternMap ?? {}) as Prisma.InputJsonValue,
        status: ContentStatus.PUBLISHED,
      },
      select: { id: true },
    });

    map[item.slug] = row.id;

    for (const [position, skillId] of item.skillIds.entries()) {
      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId: row.id, skillId } },
        create: { itemId: row.id, skillId, position },
        update: { position },
      });
    }
  }

  return map;
}

async function seedLesson(
  prisma: PrismaClient,
  ctx: {
    unitId: string;
    characters: Record<string, string>;
    audio: Record<string, string>;
    items: Record<string, string>;
  },
): Promise<void> {
  const lesson = await prisma.lesson.upsert({
    where: { slug: 'nice-to-meet-you' },
    create: { unitId: ctx.unitId, slug: 'nice-to-meet-you', order: 0 },
    update: {},
    select: { id: true },
  });

  const version = await prisma.lessonVersion.upsert({
    where: { lessonId_version: { lessonId: lesson.id, version: 1 } },
    create: {
      lessonId: lesson.id,
      version: 1,
      status: ContentStatus.PUBLISHED,
      title: 'Nice to meet you',
      objective: 'Se apresentar (nome e origem) e responder a apresentações.',
      cefrLevel: 'A1',
      estimatedMinutes: 15,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
    update: { status: ContentStatus.PUBLISHED },
    select: { id: true },
  });

  const steps = buildLessonSteps({
    characters: ctx.characters,
    audio: ctx.audio,
    items: ctx.items,
  });

  await prisma.lessonStep.deleteMany({
    where: { lessonVersionId: version.id },
  });
  await prisma.lessonStep.createMany({
    data: steps.map((step) => ({
      lessonVersionId: version.id,
      order: step.order,
      type: step.type as LessonStepType,
      content: step.content as Prisma.InputJsonValue,
    })),
  });

  const targetSkills = [
    'function.introduce-yourself',
    'grammar.be.present.affirmative',
    'chunk.nice-to-meet-you',
    'chunk.where-are-you-from',
    'grammar.contractions.be',
  ];

  for (const [position, skillId] of targetSkills.entries()) {
    await prisma.lessonTargetSkill.upsert({
      where: {
        lessonVersionId_skillId: { lessonVersionId: version.id, skillId },
      },
      create: { lessonVersionId: version.id, skillId, position },
      update: { position },
    });
  }

  // O mesmo índice que o publish escreve: é ele que barra arquivar um item
  // que está dentro de uma lição no ar.
  await prisma.lessonVersionItem.deleteMany({
    where: { lessonVersionId: version.id },
  });

  for (const slug of LESSON_ITEM_SLUGS) {
    const itemId = ctx.items[slug];

    if (itemId !== undefined) {
      await prisma.lessonVersionItem.create({
        data: { lessonVersionId: version.id, itemId },
      });
    }
  }

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { publishedVersionId: version.id },
  });
}
