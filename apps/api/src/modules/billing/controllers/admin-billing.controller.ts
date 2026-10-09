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

import { ActiveUser } from 'src/common/decorators/active-user-id.decorator';
import { RequestId } from 'src/common/decorators/request-id.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { diffFields } from 'src/infra/audit/audit-details';
import { AuditService } from 'src/infra/audit/audit.service';

import {
  CreditCostParamDto,
  GrantBonusDto,
  UpdateCreditCostDto,
  UpdatePlanDto,
} from '../dto/billing.dto';
import { AiCreditService } from '../services/ai-credit.service';
import { CreditCostService } from '../services/credit-cost.service';
import { PlansService } from '../services/plans.service';

type Actor = { id: string; email: string };

/**
 * Config dos planos, custo dos créditos e bônus. Restrito a ADMIN. Mudar
 * preço aqui não mexe em quem já assinou: a assinatura guarda o preço da
 * época. Cada escrita deixa rastro na auditoria (depois do sucesso).
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/billing')
export class AdminBillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly credits: AiCreditService,
    private readonly costs: CreditCostService,
    private readonly audit: AuditService,
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
    @ActiveUser() actor: Actor,
    @RequestId() requestId: string | undefined,
  ) {
    const before = await this.plans.get(id);
    const after = await this.plans.update(id, body);

    await this.audit.record({
      actor,
      action: 'plan.update',
      targetType: 'plan',
      targetId: id,
      details: {
        tier: after.tier,
        billingPeriod: after.billingPeriod,
        changes: diffFields(before, after, [
          'priceCents',
          'monthlyAiCredits',
          'active',
        ]),
      },
      requestId,
    });

    return after;
  }

  @Get('credit-costs')
  @ApiOperation({ summary: 'Quanto cada uso de IA custa em créditos' })
  async listCosts() {
    return { costs: await this.costs.all() };
  }

  @Patch('credit-costs/:feature')
  @ApiOperation({ summary: 'Muda o custo em créditos de um uso de IA' })
  async updateCost(
    @Param() params: CreditCostParamDto,
    @Body() body: UpdateCreditCostDto,
    @ActiveUser() actor: Actor,
    @RequestId() requestId: string | undefined,
  ) {
    const { before, after } = await this.costs.update(
      params.feature,
      body.cost,
      actor.id,
    );

    await this.audit.record({
      actor,
      action: 'credit-cost.update',
      targetType: 'credit_cost',
      targetId: params.feature,
      details: { feature: params.feature, from: before, to: after },
      requestId,
    });

    return { costs: await this.costs.all() };
  }

  @Post('users/:userId/credits/bonus')
  @ApiOperation({ summary: 'Dá créditos de IA de bônus a um aluno' })
  async grantBonus(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: GrantBonusDto,
    @ActiveUser() actor: Actor,
    @RequestId() requestId: string | undefined,
  ) {
    const balance = await this.credits.grantBonus(
      userId,
      body.amount,
      body.reason,
    );

    await this.audit.record({
      actor,
      action: 'credits.bonus',
      targetType: 'user',
      targetId: userId,
      details: {
        amount: body.amount,
        reason: body.reason,
        balanceAfter: balance,
      },
      requestId,
    });

    return { balance };
  }
}
