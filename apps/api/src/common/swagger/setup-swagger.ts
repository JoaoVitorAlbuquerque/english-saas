import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export const SWAGGER_ROUTE = 'docs';

/**
 * Monta o documento OpenAPI.
 *
 * Os DTOs feitos com `createZodDto` já expõem o metadata que o
 * @nestjs/swagger lê; o `cleanupOpenApiDoc` faz a limpeza do que sai daí
 * (é o substituto do antigo `patchNestJsSwagger()`, removido no nestjs-zod 5).
 */
export function buildOpenApiDocument(
  app: INestApplication,
  apiUrl: string,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('english-saas API')
    .setDescription(
      'API da plataforma de inglês. Códigos de erro em inglês, mensagens para o aluno em pt-BR.',
    )
    .setVersion('0.1.0')
    .addServer(apiUrl)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

export function setupSwagger(app: INestApplication, apiUrl: string): void {
  SwaggerModule.setup(SWAGGER_ROUTE, app, buildOpenApiDocument(app, apiUrl), {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'english-saas API',
  });
}
