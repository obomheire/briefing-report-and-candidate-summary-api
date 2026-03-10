import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { SampleWorkspace } from '../entities/sample-workspace.entity';
import { CreateSampleCandidateDto } from './dto/create-sample-candidate.dto';

@Injectable()
export class SampleService {
  constructor(
    @InjectRepository(SampleWorkspace)
    private readonly workspaceRepository: Repository<SampleWorkspace>,
    @InjectRepository(SampleCandidate)
    private readonly candidateRepository: Repository<SampleCandidate>,
  ) {}

  async createCandidate(user: AuthUser, dto: CreateSampleCandidateDto): Promise<SampleCandidate> {
    await this.ensureWorkspace(user.workspaceId);

    const candidate = this.candidateRepository.create({
      id: randomUUID(),
      workspaceId: user.workspaceId,
      fullName: dto.fullName.trim(),
      email: dto.email?.trim() ?? null,
    });

    return this.candidateRepository.save(candidate);
  }

  async listCandidates(user: AuthUser): Promise<SampleCandidate[]> {
    return this.candidateRepository.find({
      where: { workspaceId: user.workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  private async ensureWorkspace(workspaceId: string): Promise<void> {
    const existing = await this.workspaceRepository.findOne({ where: { id: workspaceId } });

    if (existing) {
      return;
    }

    const workspace = this.workspaceRepository.create({
      id: workspaceId,
      name: `Workspace ${workspaceId}`,
    });

    await this.workspaceRepository.save(workspace);
  }
}
