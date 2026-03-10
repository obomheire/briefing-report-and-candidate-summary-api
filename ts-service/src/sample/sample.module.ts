import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SampleCandidate } from '../entities/sample-candidate.entity';
import { SampleWorkspace } from '../entities/sample-workspace.entity';
import { SampleController } from './sample.controller';
import { SampleService } from './sample.service';

@Module({
  imports: [TypeOrmModule.forFeature([SampleWorkspace, SampleCandidate])],
  controllers: [SampleController],
  providers: [SampleService],
  exports: [SampleService],
})
export class SampleModule {}
