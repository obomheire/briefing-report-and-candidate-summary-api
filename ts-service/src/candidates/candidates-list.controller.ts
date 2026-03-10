import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidatesService } from './candidates.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Controller('candidates')
@UseGuards(FakeAuthGuard)
export class CandidatesListController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  listCandidates(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.candidatesService.listCandidates(user, query);
  }
}
