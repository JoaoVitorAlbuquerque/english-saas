import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { IsPublic } from 'src/common/decorators/is-public.decorator';

import {
  PushSubscriptionDto,
  PushUnsubscribeDto,
  UnsubscribeDto,
  UpdatePreferencesDto,
} from '../dto/notifications.dto';
import { UnsubscribeService } from '../services/unsubscribe.service';
import { PreferenceService } from '../services/preference.service';
import { PushSubscriptionService } from '../services/push-subscription.service';

/** Perfil → Notificações. */
@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  constructor(
    private readonly preferences: PreferenceService,
    private readonly push: PushSubscriptionService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Tipos, canais, hora do lembrete e silencioso' })
  async getPreferences(@ActiveUserId() userId: string) {
    return this.preferences.view(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Liga/desliga tipos e canais, muda horários' })
  async updatePreferences(
    @ActiveUserId() userId: string,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.preferences.update(userId, body);
  }

  @Get('push/public-key')
  @ApiOperation({ summary: 'Chave VAPID pública para o pushManager' })
  publicKey() {
    return this.push.publicKey();
  }

  @Post('push/subscriptions')
  @ApiOperation({ summary: 'Registra este navegador e liga o push' })
  async subscribe(
    @ActiveUserId() userId: string,
    @Body() body: PushSubscriptionDto,
  ) {
    return this.push.subscribe(userId, body);
  }

  @Delete('push/subscriptions')
  @ApiOperation({ summary: 'Desliga o push neste navegador' })
  async unsubscribe(
    @ActiveUserId() userId: string,
    @Body() body: PushUnsubscribeDto,
  ) {
    return this.push.unsubscribe(userId, body);
  }

  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manda um push de teste para os navegadores' })
  async test(@ActiveUserId() userId: string) {
    return this.push.test(userId);
  }
}

/** O link "parar de receber" do e-mail cai no front, que chama esta rota. */
@ApiTags('notifications')
@Controller('notifications')
export class UnsubscribeController {
  constructor(private readonly unsubscribes: UnsubscribeService) {}

  @IsPublic()
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desliga um tipo de aviso pelo link do e-mail' })
  async unsubscribe(@Body() body: UnsubscribeDto) {
    return this.unsubscribes.apply(body.token);
  }
}
