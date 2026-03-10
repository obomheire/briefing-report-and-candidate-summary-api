import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidatesService } from './candidates.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { SummaryWorker } from './summary.worker';

@Controller('candidates')
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly summaryWorker: SummaryWorker,
  ) {}

  @Get()
  listCandidates(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.candidatesService.listCandidates(user, query);
  }

  @Post(':candidateId/documents')
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.candidatesService.uploadDocument(user, candidateId, dto);
  }

  @Post(':candidateId/summaries/generate')
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

  @Get(':candidateId/summaries')
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.candidatesService.listSummaries(user, candidateId, query);
  }

  @Get(':candidateId/summaries/:summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ) {
    return this.candidatesService.getSummary(user, candidateId, summaryId);
  }
}
