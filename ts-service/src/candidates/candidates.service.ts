import { randomUUID } from 'crypto';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

export const SUMMARY_JOB_NAME = 'candidate.summarize';

export interface SummaryJobPayload {
  summaryId: string;
  candidateId: string;
  workspaceId: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
    @InjectRepository(SampleCandidate)
    private readonly candidateRepository: Repository<SampleCandidate>,
    private readonly queueService: QueueService,
  ) {}

  // ── Candidates ───────────────────────────────────────────────────────────

  async listCandidates(
    user: AuthUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SampleCandidate>> {
    const { page, size } = query;
    const [data, total] = await this.candidateRepository.findAndCount({
      where: { workspaceId: user.workspaceId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { data, total, page, size };
  }

  // ── Documents ────────────────────────────────────────────────────────────

  async uploadDocument(
    user: AuthUser,
    candidateId: string,
    dto: UploadDocumentDto,
  ): Promise<CandidateDocument> {
    await this.assertCandidateBelongsToWorkspace(candidateId, user.workspaceId);

    const document = this.documentRepository.create({
      id: randomUUID(),
      candidateId,
      workspaceId: user.workspaceId,
      documentType: dto.documentType,
      fileName: dto.fileName.trim(),
      storageKey: dto.storageKey.trim(),
      rawText: dto.rawText,
    });

    return this.documentRepository.save(document);
  }

  // ── Summaries ────────────────────────────────────────────────────────────

  async requestSummaryGeneration(
    user: AuthUser,
    candidateId: string,
  ): Promise<CandidateSummary> {
    await this.assertCandidateBelongsToWorkspace(candidateId, user.workspaceId);

    const summary = this.summaryRepository.create({
      id: randomUUID(),
      candidateId,
      workspaceId: user.workspaceId,
      status: 'pending',
    });

    const saved = await this.summaryRepository.save(summary);

    this.queueService.enqueue<SummaryJobPayload>(SUMMARY_JOB_NAME, {
      summaryId: saved.id,
      candidateId,
      workspaceId: user.workspaceId,
    });

    return saved;
  }

  async listSummaries(
    user: AuthUser,
    candidateId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CandidateSummary>> {
    await this.assertCandidateBelongsToWorkspace(candidateId, user.workspaceId);

    const { page, size } = query;
    const [data, total] = await this.summaryRepository.findAndCount({
      where: { candidateId, workspaceId: user.workspaceId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { data, total, page, size };
  }

  async getSummary(
    user: AuthUser,
    candidateId: string,
    summaryId: string,
  ): Promise<CandidateSummary> {
    await this.assertCandidateBelongsToWorkspace(candidateId, user.workspaceId);

    const summary = await this.summaryRepository.findOne({
      where: { id: summaryId, candidateId, workspaceId: user.workspaceId },
    });

    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} not found`);
    }

    return summary;
  }

  // ── Internal helpers used by the worker ──────────────────────────────────

  async getDocumentsForCandidate(candidateId: string): Promise<CandidateDocument[]> {
    return this.documentRepository.find({
      where: { candidateId },
      order: { uploadedAt: 'ASC' },
    });
  }

  async getSummaryById(summaryId: string): Promise<CandidateSummary | null> {
    return this.summaryRepository.findOne({ where: { id: summaryId } });
  }

  async saveSummary(summary: CandidateSummary): Promise<CandidateSummary> {
    return this.summaryRepository.save(summary);
  }

  // ── Access control ───────────────────────────────────────────────────────

  private async assertCandidateBelongsToWorkspace(
    candidateId: string,
    workspaceId: string,
  ): Promise<void> {
    // candidate_documents and candidate_summaries are always scoped to workspaceId,
    // but we also verify via the sample_candidates table that the candidate itself
    // belongs to the requester's workspace.
    const count = await this.documentRepository.manager
      .getRepository('sample_candidates')
      .count({ where: { id: candidateId, workspaceId } });

    if (count === 0) {
      // Candidate doesn't exist in this workspace — treat as not found to avoid
      // leaking candidate existence to other workspaces.
      throw new ForbiddenException(
        `Candidate ${candidateId} not found in your workspace`,
      );
    }
  }
}
