import { Test, TestingModule } from '@nestjs/testing';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SUMMARIZATION_PROVIDER } from '../llm/summarization-provider.interface';
import { CandidatesService } from './candidates.service';
import { SummaryWorker } from './summary.worker';

const PAYLOAD = {
  summaryId: 'sum-1',
  candidateId: 'candidate-1',
  workspaceId: 'workspace-1',
};

const makeSummary = (overrides: Partial<CandidateSummary> = {}): CandidateSummary =>
  ({
    id: 'sum-1',
    candidateId: 'candidate-1',
    workspaceId: 'workspace-1',
    status: 'pending',
    score: null,
    strengths: null,
    concerns: null,
    summary: null,
    recommendedDecision: null,
    provider: null,
    promptVersion: null,
    errorMessage: null,
    ...overrides,
  }) as CandidateSummary;

const makeDocument = (rawText: string): Partial<CandidateDocument> => ({
  id: 'doc-1',
  rawText,
});

describe('SummaryWorker', () => {
  let worker: SummaryWorker;

  const candidatesService = {
    getSummaryById: jest.fn(),
    getDocumentsForCandidate: jest.fn(),
    saveSummary: jest.fn(),
  };

  const fakeSummarizationProvider = {
    generateCandidateSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryWorker,
        { provide: CandidatesService, useValue: candidatesService },
        { provide: SUMMARIZATION_PROVIDER, useValue: fakeSummarizationProvider },
      ],
    }).compile();

    worker = module.get<SummaryWorker>(SummaryWorker);
  });

  it('completes summary with provider output on success', async () => {
    const summary = makeSummary();
    const providerResult = {
      score: 85,
      strengths: ['Strong TypeScript skills'],
      concerns: ['Needs more backend depth'],
      summary: 'A solid candidate with good fundamentals.',
      recommendedDecision: 'advance' as const,
    };

    candidatesService.getSummaryById.mockResolvedValue(summary);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([
      makeDocument('I have 5 years of TypeScript experience.'),
    ]);
    fakeSummarizationProvider.generateCandidateSummary.mockResolvedValue(providerResult);
    candidatesService.saveSummary.mockImplementation(async (s: unknown) => s);

    await worker.process(PAYLOAD);

    expect(fakeSummarizationProvider.generateCandidateSummary).toHaveBeenCalledWith({
      candidateId: 'candidate-1',
      documents: ['I have 5 years of TypeScript experience.'],
    });
    expect(candidatesService.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        score: 85,
        strengths: ['Strong TypeScript skills'],
        concerns: ['Needs more backend depth'],
        summary: 'A solid candidate with good fundamentals.',
        recommendedDecision: 'advance',
        errorMessage: null,
      }),
    );
  });

  it('marks summary as failed when provider throws', async () => {
    const summary = makeSummary();

    candidatesService.getSummaryById.mockResolvedValue(summary);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([]);
    fakeSummarizationProvider.generateCandidateSummary.mockRejectedValue(
      new Error('LLM returned malformed JSON'),
    );
    candidatesService.saveSummary.mockImplementation(async (s: unknown) => s);

    await worker.process(PAYLOAD);

    expect(candidatesService.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'LLM returned malformed JSON',
      }),
    );
  });

  it('skips processing if summary does not exist', async () => {
    candidatesService.getSummaryById.mockResolvedValue(null);

    await worker.process(PAYLOAD);

    expect(fakeSummarizationProvider.generateCandidateSummary).not.toHaveBeenCalled();
    expect(candidatesService.saveSummary).not.toHaveBeenCalled();
  });

  it('passes all document texts to provider', async () => {
    const summary = makeSummary();
    candidatesService.getSummaryById.mockResolvedValue(summary);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([
      makeDocument('Resume text'),
      makeDocument('Cover letter text'),
    ]);
    fakeSummarizationProvider.generateCandidateSummary.mockResolvedValue({
      score: 70,
      strengths: ['Good'],
      concerns: ['None'],
      summary: 'Fine.',
      recommendedDecision: 'hold' as const,
    });
    candidatesService.saveSummary.mockImplementation(async (s: unknown) => s);

    await worker.process(PAYLOAD);

    expect(fakeSummarizationProvider.generateCandidateSummary).toHaveBeenCalledWith({
      candidateId: 'candidate-1',
      documents: ['Resume text', 'Cover letter text'],
    });
  });
});
