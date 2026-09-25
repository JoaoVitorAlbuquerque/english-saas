import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { LearnerSkillsQueryDto } from '../dto/learner-model.dto';
import { LearnerProfileService } from '../services/learner-profile.service';

@ApiTags('learner-model')
@Controller('me')
export class LearnerProfileController {
  constructor(private readonly profiles: LearnerProfileService) {}

  @Get('learner-profile')
  @ApiOperation({
    summary:
      'Nível por competência, pontos fortes e fracos, erros recorrentes e o que estudar agora',
  })
  async profile(@ActiveUserId() userId: string) {
    return this.profiles.getProfile(userId);
  }

  @Get('skills')
  @ApiOperation({ summary: 'Mastery por skill, paginado por cursor' })
  async skills(
    @ActiveUserId() userId: string,
    @Query() query: LearnerSkillsQueryDto,
  ) {
    return this.profiles.listSkills(userId, query);
  }
}
