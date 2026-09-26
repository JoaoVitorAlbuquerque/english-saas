import { Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { BillingModule } from 'src/modules/billing/billing.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearnerModelModule } from 'src/modules/learner-model/learner-model.module';
import { LearningModule } from 'src/modules/learning/learning.module';
import { SrsModule } from 'src/modules/srs/srs.module';

import { GeneratorController } from './controllers/generator.controller';
import { MaterialsController } from './controllers/materials.controller';
import { GeneratorProcessor } from './jobs/generator.processor';
import {
  ArticleFetcher,
  FakeArticleFetcher,
  HttpArticleFetcher,
} from './services/article-fetcher';
import { GenerationPipelineService } from './services/generation-pipeline.service';
import { GenerationRequestService } from './services/generation-request.service';
import { IngestSources } from './services/ingest-sources';
import { MaterialService } from './services/material.service';
import { SourceService } from './services/source.service';
import {
  FakeWikipediaClient,
  HttpWikipediaClient,
  WikipediaClient,
} from './services/wikipedia-client';

function resolveWikipedia(
  env: EnvService,
  http: HttpWikipediaClient,
  fake: FakeWikipediaClient,
): WikipediaClient {
  const choice = env.get('SOURCE_PROVIDER');
  if (choice === 'fake') return fake;
  if (choice === 'wikipedia') return http;
  return env.isTest ? fake : http;
}

function resolveArticleFetcher(
  env: EnvService,
  http: HttpArticleFetcher,
  fake: FakeArticleFetcher,
): ArticleFetcher {
  const choice = env.get('ARTICLE_FETCH_PROVIDER');
  if (choice === 'fake') return fake;
  if (choice === 'http') return http;
  return env.isTest ? fake : http;
}

/**
 * Módulo 13 — generator (Plus).
 *
 * Material de estudo feito para o aluno: (a) sobre um assunto real, com
 * fatos da Wikipedia em inglês e checagem de cada fato; (b) a partir de um
 * texto ou link que ele mandou. Lê o modelo do aluno (7) para nível e
 * alvos, cobra créditos do billing (11), grava os exercícios como itens
 * privados no curriculum (4), recebe as respostas pelo learning (6) e
 * entrega o vocabulário ao SRS (9) como termos do aluno.
 *
 * Tudo que chama IA ou sai para a internet roda na fila `generator`.
 */
@Module({
  imports: [
    AiModule,
    BillingModule,
    CurriculumModule,
    LearningModule,
    LearnerModelModule,
    SrsModule,
    // Uma tentativa a menos que o padrão: cada uma pode custar várias
    // chamadas de IA, e as etapas já feitas não se repetem.
    registerQueue(QUEUES.GENERATOR, { attempts: 2 }),
  ],
  controllers: [GeneratorController, MaterialsController],
  providers: [
    GenerationRequestService,
    GenerationPipelineService,
    MaterialService,
    SourceService,
    IngestSources,
    GeneratorProcessor,
    HttpWikipediaClient,
    FakeWikipediaClient,
    {
      provide: WikipediaClient,
      inject: [EnvService, HttpWikipediaClient, FakeWikipediaClient],
      useFactory: resolveWikipedia,
    },
    HttpArticleFetcher,
    FakeArticleFetcher,
    {
      provide: ArticleFetcher,
      inject: [EnvService, HttpArticleFetcher, FakeArticleFetcher],
      useFactory: resolveArticleFetcher,
    },
  ],
})
export class GeneratorModule {}
