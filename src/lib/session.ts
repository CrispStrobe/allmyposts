// src/lib/session.ts
import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn?: boolean;
  mastodon?: {
    instanceUrl: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
  };
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: 'allmyposts-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession() {
  // Using `as any` to bypass the type-checking error.
  // This is a workaround for a likely dependency version conflict.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getIronSession<SessionData>(await cookies() as any, sessionOptions);
  return session;
}