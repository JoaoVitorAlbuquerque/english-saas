import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { localDate } from 'src/modules/learning/domain/streak';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  AgendaQueryDto,
  CompleteBlockDto,
  SkipBlockDto,
} from '../dto/planner.dto';
import { AgendaDateMustBeTodayError } from '../planner.errors';
import { AgendaService } from '../services/agenda.service';

@ApiTags('planner')
@Controller('me/agenda')
export class AgendaController {
  constructor(
    private readonly agenda: AgendaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'A agenda de hoje, no fuso do aluno' })
  async today(@ActiveUserId() userId: string, @Query() query: AgendaQueryDto) {
    if (query.date !== undefined) {
      const timezone = await this.users.timezoneOf(userId);
      const today = localDate(new Date(), timezone);

      if (query.date !== today) {
        throw new AgendaDateMustBeTodayError(today);
      }
    }

    return this.agenda.today(userId);
  }

  @Post('blocks/:id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca um bloco da agenda de hoje como pulado' })
  async skip(
    @ActiveUserId() userId: string,
    @Param('id') blockId: string,
    @Body() body: SkipBlockDto,
  ) {
    return this.agenda.skip(userId, blockId, body);
  }

  @Post('blocks/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Marca um bloco da agenda de hoje como concluído. Repetir é inofensivo.',
  })
  async complete(
    @ActiveUserId() userId: string,
    @Param('id') blockId: string,
    @Body() body: CompleteBlockDto,
  ) {
    return this.agenda.complete(userId, blockId, body);
  }
}
