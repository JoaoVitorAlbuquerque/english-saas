import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { IsPublic } from 'src/common/decorators/is-public.decorator';

import { AiUsageQueryDto, EchoLevelRequestDto } from '../dto/echo-level.dto';
import { echoLevelPrompt } from '../prompts/echo-level.prompt';
import { listPrompts } from '../prompts/registry';
import { AiService } from '../services/ai.service';
import { AiUsageService } from '../services/ai-usage.service';

/**
 * Rotas administrativas do módulo de IA, atrás da basic auth de `/admin/*`.
 *
 * O `echo-level` é o exemplo vivo do módulo: exercita o caminho completo
 * (prompt versionado → cache → provider → zod → custo → `ai_usages`).
 *
 * Roda síncrono por ser ferramenta de diagnóstico. **Chamada de IA de
 * produto vai para a fila** — ver CLAUDE.md.
 */
@ApiTags('admin')
@Controller('admin/ai')
export class AiAdminController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiUsage: AiUsageService,
  ) {}

  @IsPublic()
  @Get('prompts')
  @ApiOperation({ summary: 'Catálogo de prompts versionados' })
  prompts(): ReturnType<typeof listPrompts> {
    return listPrompts();
  }

  @IsPublic()
  @Post('echo-level')
  @ApiOperation({
    summary:
      'Classifica uma frase em inglês por nível CEFR (prompt de exemplo)',
  })
  async echoLevel(@Body() body: EchoLevelRequestDto) {
    return this.aiService.run(
      echoLevelPrompt,
      { sentence: body.sentence },
      { skipCache: body.skipCache },
    );
  }

  @IsPublic()
  @Get('usage')
  @ApiOperation({ summary: 'Totais de consumo de IA por feature e período' })
  async usage(@Query() query: AiUsageQueryDto) {
    const period = {
      ...(query.from === undefined ? {} : { from: new Date(query.from) }),
      ...(query.to === undefined ? {} : { to: new Date(query.to) }),
    };

    const [totals, byFeature] = await Promise.all([
      this.aiUsage.totals({
        ...(query.userId === undefined ? {} : { userId: query.userId }),
        ...(query.feature === undefined ? {} : { feature: query.feature }),
        ...period,
      }),
      this.aiUsage.totalsByFeature({
        ...(query.userId === undefined ? {} : { userId: query.userId }),
        ...period,
      }),
    ]);

    return { totals, byFeature };
  }
}
