export interface AuthUser {
  userId: string;
  workspaceId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
