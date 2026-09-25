import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { RebuildPlanDto } from '../dto/planner.dto';
import { PlanService } from '../services/plan.service';

@ApiTags('planner')
@Controller('me/plan')
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'O plano atual: trilha, reforço e forecast' })
  async get(@ActiveUserId() userId: string) {
    return this.plans.getPlan(userId);
  }

  @Post('rebuild')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconstrói o plano do zero' })
  async rebuild(@ActiveUserId() userId: string, @Body() body: RebuildPlanDto) {
    const outcome = await this.plans.rebuild(userId, body.targetLevel);

    return outcome.status === 'LOCKED'
      ? this.plans.getPlan(userId)
      : outcome.plan;
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Data prevista pra chegar no nível-alvo' })
  async forecast(@ActiveUserId() userId: string) {
    const [plan, pace] = await Promise.all([
      this.plans.getPlan(userId),
      this.plans.paceStatus(userId),
    ]);

    return { forecast: plan.forecast, ...pace };
  }
}
