import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CreateSampleCandidateDto } from './dto/create-sample-candidate.dto';
import { SampleService } from './sample.service';

@Controller('sample')
@UseGuards(FakeAuthGuard)
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Post('candidates')
  async createCandidate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSampleCandidateDto,
  ) {
    return this.sampleService.createCandidate(user, dto);
  }

  @Get('candidates')
  async listCandidates(@CurrentUser() user: AuthUser) {
    return this.sampleService.listCandidates(user);
  }
}
