import { Injectable } from '@nestjs/common';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  SummarizationProvider,
} from './summarization-provider.interface';

@Injectable()
export class FakeSummarizationProvider implements SummarizationProvider {
  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    const docCount = input.documents.length;

    return {
      score: docCount > 0 ? 72 : 40,
      strengths: ['Communicates clearly', 'Relevant project exposure'],
      concerns: docCount > 1 ? ['Needs deeper system design examples'] : ['Limited context provided'],
      summary: `Fake summary for candidate ${input.candidateId} using ${docCount} document(s).`,
      recommendedDecision: docCount > 0 ? 'hold' : 'reject',
    };
  }
}
