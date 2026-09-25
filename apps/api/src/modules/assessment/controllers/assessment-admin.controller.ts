import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';

import { FlaggedItemsQueryDto } from '../dto/assessment.dto';
import { CalibrationService } from '../services/calibration.service';

/** Itens que a calibração marcou para o editor olhar. */
@ApiTags('assessment')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/assessment')
export class AssessmentAdminController {
  constructor(private readonly calibration: CalibrationService) {}

  @Get('flagged-items')
  @ApiOperation({
    summary: 'Itens fáceis demais, difíceis demais ou que discriminam mal',
  })
  async flagged(@Query() query: FlaggedItemsQueryDto) {
    return this.calibration.listFlagged(query);
  }

  @Post('flagged-items/:itemId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca o problema do item como resolvido' })
  async resolve(
    @ActiveUserId() editorId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.calibration.resolve(itemId, editorId);
  }
}
