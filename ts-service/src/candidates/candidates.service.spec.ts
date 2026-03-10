import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { CandidatesService, SUMMARY_JOB_NAME } from './candidates.service';

const USER = { userId: 'user-1', workspaceId: 'workspace-1' };
const CANDIDATE_ID = 'candidate-1';

const mockDocumentRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  manager: {
    getRepository: jest.fn().mockReturnValue({
      count: jest.fn(),
    }),
  },
});

const mockSummaryRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
});

const mockQueueService = () => ({
  enqueue: jest.fn(),
});

describe('CandidatesService', () => {
  let service: CandidatesService;
  let documentRepo: ReturnType<typeof mockDocumentRepository>;
  let summaryRepo: ReturnType<typeof mockSummaryRepository>;
  let queueService: ReturnType<typeof mockQueueService>;

  beforeEach(async () => {
    documentRepo = mockDocumentRepository();
    summaryRepo = mockSummaryRepository();
    queueService = mockQueueService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        { provide: getRepositoryToken(CandidateDocument), useValue: documentRepo },
        { provide: getRepositoryToken(CandidateSummary), useValue: summaryRepo },
        { provide: getRepositoryToken(SampleCandidate), useValue: {} },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── helpers ──────────────────────────────────────────────────────────────

  const allowAccess = () =>
    documentRepo.manager.getRepository().count.mockResolvedValue(1);

  const denyAccess = () =>
    documentRepo.manager.getRepository().count.mockResolvedValue(0);

  // ── uploadDocument ───────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    const dto = {
      documentType: 'resume' as const,
      fileName: '  cv.pdf  ',
      storageKey: 's3://bucket/cv.pdf',
      rawText: 'Experienced engineer...',
    };

    it('saves and returns a document', async () => {
      allowAccess();
      const created = { id: 'doc-1', candidateId: CANDIDATE_ID, fileName: 'cv.pdf' };
      documentRepo.create.mockReturnValue(created);
      documentRepo.save.mockResolvedValue(created);

      const result = await service.uploadDocument(USER, CANDIDATE_ID, dto);

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: CANDIDATE_ID,
          workspaceId: USER.workspaceId,
          documentType: 'resume',
          fileName: 'cv.pdf',
          storageKey: 's3://bucket/cv.pdf',
        }),
      );
      expect(result).toBe(created);
    });

    it('trims fileName and storageKey', async () => {
      allowAccess();
      documentRepo.create.mockImplementation((v: unknown) => v);
      documentRepo.save.mockImplementation(async (v: unknown) => v);

      const result = await service.uploadDocument(USER, CANDIDATE_ID, dto);
      expect((result as { fileName: string }).fileName).toBe('cv.pdf');
    });

    it('throws ForbiddenException if candidate not in workspace', async () => {
      denyAccess();
      await expect(service.uploadDocument(USER, CANDIDATE_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── requestSummaryGeneration ─────────────────────────────────────────────

  describe('requestSummaryGeneration', () => {
    it('creates a pending summary and enqueues a job', async () => {
      allowAccess();
      const pendingSummary = { id: 'sum-1', status: 'pending', candidateId: CANDIDATE_ID };
      summaryRepo.create.mockReturnValue(pendingSummary);
      summaryRepo.save.mockResolvedValue(pendingSummary);

      const result = await service.requestSummaryGeneration(USER, CANDIDATE_ID);

      expect(result.status).toBe('pending');
      expect(queueService.enqueue).toHaveBeenCalledWith(
        SUMMARY_JOB_NAME,
        expect.objectContaining({ summaryId: 'sum-1', candidateId: CANDIDATE_ID }),
      );
    });

    it('throws ForbiddenException if candidate not in workspace', async () => {
      denyAccess();
      await expect(service.requestSummaryGeneration(USER, CANDIDATE_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── listSummaries ────────────────────────────────────────────────────────

  describe('listSummaries', () => {
    it('returns summaries scoped to candidate and workspace', async () => {
      allowAccess();
      const summaries = [{ id: 'sum-1' }, { id: 'sum-2' }];
      summaryRepo.findAndCount.mockResolvedValue([summaries, 2]);

      const query = { page: 1, size: 10 };
      const result = await service.listSummaries(USER, CANDIDATE_ID, query);

      expect(summaryRepo.findAndCount).toHaveBeenCalledWith({
        where: { candidateId: CANDIDATE_ID, workspaceId: USER.workspaceId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ── getSummary ───────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns the summary when found', async () => {
      allowAccess();
      const summary = { id: 'sum-1', status: 'completed' };
      summaryRepo.findOne.mockResolvedValue(summary);

      const result = await service.getSummary(USER, CANDIDATE_ID, 'sum-1');

      expect(summaryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'sum-1', candidateId: CANDIDATE_ID, workspaceId: USER.workspaceId },
      });
      expect(result).toBe(summary);
    });

    it('throws NotFoundException when summary does not exist', async () => {
      allowAccess();
      summaryRepo.findOne.mockResolvedValue(null);

      await expect(service.getSummary(USER, CANDIDATE_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if candidate not in workspace', async () => {
      denyAccess();
      await expect(service.getSummary(USER, CANDIDATE_ID, 'sum-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
