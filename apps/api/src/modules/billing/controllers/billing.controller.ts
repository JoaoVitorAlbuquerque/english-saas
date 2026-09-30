import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { IsPublic } from 'src/common/decorators/is-public.decorator';

import { AI_CREDIT_COSTS } from '../domain/credits';
import { CheckoutDto, CreditHistoryQueryDto } from '../dto/billing.dto';
import { AiCreditService } from '../services/ai-credit.service';
import { EntitlementsService } from '../services/entitlements.service';
import { PlansService } from '../services/plans.service';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionService,
    private readonly entitlements: EntitlementsService,
    private readonly credits: AiCreditService,
  ) {}

  @IsPublic()
  @Get('plans')
  @ApiOperation({ summary: 'Planos à venda, com o preço por extenso' })
  async listPlans() {
    return this.plans.list({ activeOnly: true });
  }

  @Post('billing/checkout')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Abre a assinatura; o link de pagamento aparece em GET /me/subscription',
  })
  async checkout(@ActiveUserId() userId: string, @Body() body: CheckoutDto) {
    return this.subscriptions.checkout(userId, body);
  }

  @Post('billing/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancela na hora; o acesso segue até o fim do período pago',
  })
  async cancel(@ActiveUserId() userId: string) {
    return this.subscriptions.cancel(userId);
  }

  @Get('me/subscription')
  @ApiOperation({ summary: 'Plano que vale agora e a situação da assinatura' })
  async subscription(@ActiveUserId() userId: string) {
    return this.subscriptions.overview(userId);
  }

  @Get('me/credits')
  @ApiOperation({ summary: 'Saldo de créditos de IA e quanto cada uso custa' })
  async myCredits(@ActiveUserId() userId: string) {
    const [plan, balance] = await Promise.all([
      this.entitlements.currentPlan(userId),
      this.credits.balanceFor(userId),
    ]);

    return {
      tier: plan.tier,
      balance,
      monthlyAiCredits: plan.monthlyAiCredits,
      costs: AI_CREDIT_COSTS,
    };
  }

  @Get('me/credits/history')
  @ApiOperation({ summary: 'Extrato de créditos de IA, mais recente primeiro' })
  async myCreditsHistory(
    @ActiveUserId() userId: string,
    @Query() query: CreditHistoryQueryDto,
  ) {
    return this.credits.history(userId, query);
  }
}
