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
    userId?: string; // Add user ID to store for caching keys
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getIronSession<SessionData>(await cookies() as any, sessionOptions);
  return session;
}