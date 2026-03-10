import { randomUUID } from 'crypto';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

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
    private readonly queueService: QueueService,
  ) {}

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
  ): Promise<CandidateSummary[]> {
    await this.assertCandidateBelongsToWorkspace(candidateId, user.workspaceId);

    return this.summaryRepository.find({
      where: { candidateId, workspaceId: user.workspaceId },
      order: { createdAt: 'DESC' },
    });
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
