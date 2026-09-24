import { Module } from '@nestjs/common';

import { CatalogController } from './controllers/catalog.controller';
import { ItemAdminController } from './controllers/item-admin.controller';
import { LessonAdminController } from './controllers/lesson-admin.controller';
import { StructureAdminController } from './controllers/structure-admin.controller';
import { TaxonomyAdminController } from './controllers/taxonomy-admin.controller';
import { AssetUrlService } from './services/asset-url.service';
import { CatalogCacheService } from './services/catalog-cache.service';
import { CatalogService } from './services/catalog.service';
import { ItemService } from './services/item.service';
import { LessonAuthoringService } from './services/lesson-authoring.service';
import { StructureService } from './services/structure.service';
import { TaxonomyService } from './services/taxonomy.service';

/**
 * Módulo 4 — curriculum.
 *
 * Dono do conteúdo base: taxonomia (skills, erros típicos, registro
 * falado), estrutura (curso, nível, unidade, personagem), lições
 * versionadas, banco de questões e mídia.
 *
 * Os módulos seguintes leem daqui pelos serviços exportados — `learning`
 * (6) monta o player a partir do `CatalogService`, `assessment` (8) sorteia
 * item pelo `ItemService`, `learner-model` (7) resolve skill pelo
 * `TaxonomyService`. Ninguém varre essas tabelas por fora.
 *
 * Não tem fila: publicar é uma transação curta. O que existe é cache de
 * leitura no Redis, com a versão da lição na chave.
 */
@Module({
  controllers: [
    CatalogController,
    TaxonomyAdminController,
    StructureAdminController,
    LessonAdminController,
    ItemAdminController,
  ],
  providers: [
    CatalogService,
    CatalogCacheService,
    AssetUrlService,
    TaxonomyService,
    StructureService,
    LessonAuthoringService,
    ItemService,
  ],
  exports: [CatalogService, TaxonomyService, ItemService, StructureService],
})
export class CurriculumModule {}
