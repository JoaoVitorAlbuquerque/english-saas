import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsentType } from '@prisma/client';
import type { Request } from 'express';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import {
  CompleteOnboardingDto,
  ReplaceInterestsDto,
  UpdateConsentDto,
  UpdateMeDto,
  UpdateProfileDto,
} from '../dto/users.dto';
import { ConsentService } from '../services/consent.service';
import { DataExportService } from '../services/data-export.service';
import { UsersService } from '../services/users.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly consents: ConsentService,
    private readonly dataExport: DataExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Conta do aluno autenticado' })
  async me(@ActiveUserId() userId: string) {
    return this.users.findById(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Atualiza os dados da conta' })
  async updateMe(@ActiveUserId() userId: string, @Body() body: UpdateMeDto) {
    return this.users.updateAccount(userId, body);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Perfil de estudo' })
  async profile(@ActiveUserId() userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Atualiza o perfil de estudo' })
  async updateProfile(
    @ActiveUserId() userId: string,
    @Body() body: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, this.toProfileUpdate(body));
  }

  @Get('interests')
  @ApiOperation({ summary: 'Temas de interesse, do mais forte ao mais fraco' })
  async interests(@ActiveUserId() userId: string) {
    return this.users.listInterests(userId);
  }

  @Put('interests')
  @ApiOperation({
    summary:
      'Substitui os interesses escolhidos pelo aluno (mantém os aprendidos)',
  })
  async replaceInterests(
    @ActiveUserId() userId: string,
    @Body() body: ReplaceInterestsDto,
  ) {
    return this.users.replaceInterests(userId, body.interests);
  }

  @Post('onboarding')
  @ApiOperation({
    summary: 'Salva o onboarding inteiro e emite o evento user.onboarded',
  })
  async completeOnboarding(
    @ActiveUserId() userId: string,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(userId, {
      ...this.toProfileUpdate(body),
      interests: body.interests,
    });
  }

  // -------------------------------------------------------------------
  // LGPD
  // -------------------------------------------------------------------

  @Get('consents')
  @ApiOperation({ summary: 'Consentimentos registrados e suas versões' })
  async listConsents(@ActiveUserId() userId: string) {
    return this.consents.listForUser(userId);
  }

  @Put('consents')
  @ApiOperation({ summary: 'Concede ou revoga um consentimento' })
  async updateConsent(
    @ActiveUserId() userId: string,
    @Body() body: UpdateConsentDto,
    @Req() request: Request,
  ) {
    await this.consents.record(userId, body.type as ConsentType, body.granted, {
      ...(request.ip === undefined ? {} : { ip: request.ip }),
      ...(request.headers['user-agent'] === undefined
        ? {}
        : { userAgent: request.headers['user-agent'].slice(0, 255) }),
    });

    return this.consents.listForUser(userId);
  }

  /**
   * Estado do último export, com URL assinada quando pronto.
   * O pedido em si é o POST — juntar os dados não cabe num GET.
   */
  @Get('export')
  @ApiOperation({ summary: 'Último export de dados e a URL de download' })
  async latestExport(@ActiveUserId() userId: string) {
    return this.dataExport.latest(userId);
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede um export dos seus dados (roda em fila)' })
  async requestExport(@ActiveUserId() userId: string) {
    return this.dataExport.request(userId);
  }

  @Get('export/:id')
  @ApiOperation({ summary: 'Estado de um export específico' })
  async exportById(@ActiveUserId() userId: string, @Param('id') id: string) {
    return this.dataExport.findById(userId, id);
  }

  @Delete()
  @ApiOperation({
    summary: 'Exclui a conta: sai do ar agora, é anonimizada em 30 dias',
  })
  async deleteMe(@ActiveUserId() userId: string) {
    return this.users.requestDeletion(userId);
  }

  /** `targetDate` chega como string ISO e o Prisma espera Date. */
  private toProfileUpdate(body: {
    targetDate?: string | null | undefined;
  }): Record<string, unknown> {
    const { targetDate, ...rest } = body as Record<string, unknown> & {
      targetDate?: string | null;
    };

    return {
      ...rest,
      ...(targetDate === undefined
        ? {}
        : { targetDate: targetDate === null ? null : new Date(targetDate) }),
    };
  }
}
