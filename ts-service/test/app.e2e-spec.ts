import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from '../src/health/health.controller';
import { HealthModule } from '../src/health/health.module';

describe('Health (starter test)', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    controller = moduleFixture.get<HealthController>(HealthController);
  });

  it('returns healthy status', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });
});
