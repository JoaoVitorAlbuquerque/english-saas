import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from 'src/common/decorators/roles.decorator';

import { GrantBonusDto, UpdatePlanDto } from '../dto/billing.dto';
import { AiCreditService } from '../services/ai-credit.service';
import { PlansService } from '../services/plans.service';

/**
 * Config dos planos e bônus de crédito. Restrito a ADMIN — o painel
 * completo vem no módulo 17. Mudar preço aqui não mexe em quem já assinou:
 * a assinatura guarda o preço da época.
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/billing')
export class AdminBillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly credits: AiCreditService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Todos os planos, inclusive os fora de venda' })
  async listPlans() {
    return this.plans.list({ activeOnly: false });
  }

  @Patch('plans/:id')
  @ApiOperation({
    summary: 'Altera preço, cota de créditos ou disponibilidade',
  })
  async updatePlan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePlanDto,
  ) {
    return this.plans.update(id, body);
  }

  @Post('users/:userId/credits/bonus')
  @ApiOperation({ summary: 'Dá créditos de IA de bônus a um aluno' })
  async grantBonus(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: GrantBonusDto,
  ) {
    return {
      balance: await this.credits.grantBonus(userId, body.amount, body.reason),
    };
  }
}
