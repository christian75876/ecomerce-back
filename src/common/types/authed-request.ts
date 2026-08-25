import { Request } from 'express';

export interface AuthedUser {
  userId: number;
  role: string;
}

/** Request shape after JwtAuthGuard has run — req.user is always populated by then. */
export type AuthedRequest = Request & { user: AuthedUser };
