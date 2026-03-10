import { Module } from '@nestjs/common';

import { FakeSummarizationProvider } from './fake-summarization.provider';
import { SUMMARIZATION_PROVIDER } from './summarization-provider.interface';

@Module({
  providers: [
    FakeSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      useExisting: FakeSummarizationProvider,
    },
  ],
  exports: [SUMMARIZATION_PROVIDER, FakeSummarizationProvider],
})
export class LlmModule {}
