import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CandidateSummaryInput,
  SummarizationProvider,
  SUMMARIZATION_PROVIDER,
} from '../llm/summarization-provider.interface';
import { CandidatesService, SummaryJobPayload } from './candidates.service';

export const PROVIDER_NAME = 'gemini';

@Injectable()
export class SummaryWorker {
  private readonly logger = new Logger(SummaryWorker.name);

  constructor(
    private readonly candidatesService: CandidatesService,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {}

  async process(payload: SummaryJobPayload): Promise<void> {
    const { summaryId, candidateId } = payload;

    const summary = await this.candidatesService.getSummaryById(summaryId);
    if (!summary) {
      this.logger.error(`Summary ${summaryId} not found — skipping`);
      return;
    }

    const documents = await this.candidatesService.getDocumentsForCandidate(candidateId);

    const input: CandidateSummaryInput = {
      candidateId,
      documents: documents.map((d) => d.rawText),
    };

    try {
      const result = await this.summarizationProvider.generateCandidateSummary(input);

      summary.status = 'completed';
      summary.score = result.score;
      summary.strengths = result.strengths;
      summary.concerns = result.concerns;
      summary.summary = result.summary;
      summary.recommendedDecision = result.recommendedDecision;
      summary.provider = PROVIDER_NAME;
      summary.promptVersion = '1.0';
      summary.errorMessage = null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Summarization failed for ${summaryId}: ${message}`);

      summary.status = 'failed';
      summary.errorMessage = message;
    }

    await this.candidatesService.saveSummary(summary);
  }
}
