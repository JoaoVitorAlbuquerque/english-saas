import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUser } from 'src/common/decorators/active-user-id.decorator';
import { RequestId } from 'src/common/decorators/request-id.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { NotFoundError } from 'src/common/errors/app.exception';
import { CursorPaginationQueryDto } from 'src/common/pagination/cursor-pagination.dto';
import { AuditService } from 'src/infra/audit/audit.service';
import { AiUsageService } from 'src/modules/ai/services/ai-usage.service';
import { nextCreditGrantAt } from 'src/modules/billing/domain/credits';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import { CreditCostService } from 'src/modules/billing/services/credit-cost.service';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { SubscriptionService } from 'src/modules/billing/services/subscription.service';
import { AttemptService } from 'src/modules/learning/services/attempt.service';
import { PlanService } from 'src/modules/planner/services/plan.service';
import { ProgressQueryDto } from 'src/modules/progress/dto/progress.dto';
import { StudentProgressService } from 'src/modules/progress/services/student-progress.service';
import { UsersService } from 'src/modules/users/services/users.service';

import { StudentAiUsageQueryDto } from '../dto/admin.dto';

type Actor = { id: string; email: string };

/**
 * A ficha do aluno para o admin. Cada rota é fina: delega ao serviço que é
 * dono do dado, o mesmo que responde `GET /me/*` — por isso as respostas têm o
 * mesmo formato e o painel reaproveita os schemas do app do aluno. O nível e
 * as forças e fraquezas vêm do painel de progresso (14), que já lê o modelo do
 * aluno; as frases reais do aluno (`learner-profile`) ficam de fora de propósito.
 *
 * Abrir a ficha (`GET :id`) deixa rastro na auditoria: é dado pessoal. As
 * seções (nível, plano, créditos…) são lidas pela mesma tela, então não
 * registram de novo.
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/users/:id')
export class AdminStudentsController {
  constructor(
    private readonly users: UsersService,
    private readonly progress: StudentProgressService,
    private readonly plans: PlanService,
    private readonly attempts: AttemptService,
    private readonly subscriptions: SubscriptionService,
    private readonly entitlements: EntitlementsService,
    private readonly credits: AiCreditService,
    private readonly costs: CreditCostService,
    private readonly aiUsage: AiUsageService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Conta, perfil de estudo e interesses do aluno' })
  async overview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @ActiveUser() actor: Actor,
    @RequestId() requestId: string | undefined,
  ) {
    const overview = await this.users.getForAdmin(id);

    await this.audit.record({
      actor,
      action: 'student.view',
      targetType: 'user',
      targetId: id,
      requestId,
    });

    return overview;
  }

  @Get('progress')
  @ApiOperation({ summary: 'O painel de progresso, como o aluno o vê' })
  async studentProgress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ProgressQueryDto,
  ) {
    return this.progress.get(id, query.weeks);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Plano de estudos e ritmo; `plan: null` sem plano' })
  async studyPlan(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      const [plan, pace] = await Promise.all([
        this.plans.getPlan(id),
        this.plans.paceStatus(id),
      ]);

      return { plan, pace };
    } catch (error) {
      // Aluno sem plano ainda é um estado normal, não um erro da tela.
      if (error instanceof NotFoundError) {
        return { plan: null, pace: null };
      }

      throw error;
    }
  }

  @Get('history')
  @ApiOperation({ summary: 'Lições que o aluno fez, mais recente primeiro' })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.attempts.history(id, query);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Plano que vale agora e a situação da assinatura' })
  async subscription(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptions.overview(id);
  }

  @Get('credits')
  @ApiOperation({ summary: 'Saldo de créditos de IA, cota e custos vigentes' })
  async creditBalance(@Param('id', new ParseUUIDPipe()) id: string) {
    const [plan, balance, costs] = await Promise.all([
      this.entitlements.currentPlan(id),
      this.credits.balanceFor(id),
      this.costs.all(),
    ]);

    return {
      tier: plan.tier,
      balance,
      monthlyAiCredits: plan.monthlyAiCredits,
      costs,
      nextGrantAt: nextCreditGrantAt(new Date()).toISOString(),
    };
  }

  @Get('credits/history')
  @ApiOperation({ summary: 'Extrato de créditos, mais recente primeiro' })
  async creditHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.credits.history(id, query);
  }

  @Get('ai-usage')
  @ApiOperation({ summary: 'Consumo de IA do aluno, no total e por feature' })
  async aiUsageOf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: StudentAiUsageQueryDto,
  ) {
    const period = {
      ...(query.from === undefined ? {} : { from: new Date(query.from) }),
      ...(query.to === undefined ? {} : { to: new Date(query.to) }),
    };

    const [totals, byFeature] = await Promise.all([
      this.aiUsage.totals({ userId: id, ...period }),
      this.aiUsage.totalsByFeature({ userId: id, ...period }),
    ]);

    return { totals, byFeature };
  }
}
