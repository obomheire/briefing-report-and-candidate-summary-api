import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RecommendedDecision } from '../llm/summarization-provider.interface';
import { SampleCandidate } from './sample-candidate.entity';

export type SummaryStatus = 'pending' | 'completed' | 'failed';

@Entity({ name: 'candidate_summaries' })
export class CandidateSummary {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'candidate_id', type: 'varchar', length: 64 })
  candidateId!: string;

  @Column({ name: 'workspace_id', type: 'varchar', length: 64 })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: SummaryStatus;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  score!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  strengths!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  concerns!: string[] | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({
    name: 'recommended_decision',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  recommendedDecision!: RecommendedDecision | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider!: string | null;

  @Column({ name: 'prompt_version', type: 'varchar', length: 50, nullable: true })
  promptVersion!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => SampleCandidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: SampleCandidate;
}
