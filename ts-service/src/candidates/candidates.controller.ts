import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidatesService } from './candidates.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { SummaryWorker } from './summary.worker';

@Controller('candidates/:candidateId')
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly summaryWorker: SummaryWorker,
  ) {}

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.candidatesService.uploadDocument(user, candidateId, dto);
  }

  @Post('summaries/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    const summary = await this.candidatesService.requestSummaryGeneration(user, candidateId);

    // Kick off async processing without blocking the response
    void this.summaryWorker.process({
      summaryId: summary.id,
      candidateId,
      workspaceId: user.workspaceId,
    });

    return summary;
  }

  @Get('summaries')
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.candidatesService.listSummaries(user, candidateId);
  }

  @Get('summaries/:summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ) {
    return this.candidatesService.getSummary(user, candidateId, summaryId);
  }
}
