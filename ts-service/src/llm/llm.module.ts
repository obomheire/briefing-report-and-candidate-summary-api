import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FakeSummarizationProvider } from './fake-summarization.provider';
import { GeminiSummarizationProvider } from './gemini-summarization.provider';
import { SUMMARIZATION_PROVIDER } from './summarization-provider.interface';

@Module({
  providers: [
    FakeSummarizationProvider,
    GeminiSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      inject: [ConfigService, FakeSummarizationProvider, GeminiSummarizationProvider],
      useFactory: (
        config: ConfigService,
        fake: FakeSummarizationProvider,
        gemini: GeminiSummarizationProvider,
      ) => {
        return config.get<string>('GEMINI_API_KEY') ? gemini : fake;
      },
    },
  ],
  exports: [SUMMARIZATION_PROVIDER, FakeSummarizationProvider],
})
export class LlmModule {}
