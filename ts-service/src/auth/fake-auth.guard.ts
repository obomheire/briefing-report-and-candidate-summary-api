import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthUser } from './auth.types';

@Injectable()
export class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const userIdHeader = request.header('x-user-id');
    const workspaceIdHeader = request.header('x-workspace-id');

    if (!userIdHeader || !workspaceIdHeader) {
      throw new UnauthorizedException(
        'Missing required headers: x-user-id and x-workspace-id',
      );
    }

    const user: AuthUser = {
      userId: userIdHeader,
      workspaceId: workspaceIdHeader,
    };

    request.user = user;
    return true;
  }
}
