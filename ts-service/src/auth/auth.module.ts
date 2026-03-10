import { Module } from '@nestjs/common';

import { FakeAuthGuard } from './fake-auth.guard';

@Module({
  providers: [FakeAuthGuard],
  exports: [FakeAuthGuard],
})
export class AuthModule {}
