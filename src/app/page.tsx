// src/app/page.tsx
import SmartSearch from '@/components/SmartSearch';
import MastodonAuth from '@/components/MastodonAuth';
import { Github } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getAuthenticatedMastoClient } from '@/lib/mastodon-agent';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  const isMastodonConnected = !!session.isLoggedIn && !!session.mastodon?.accessToken;
  let mastodonUserHandle: string | undefined = undefined;

  // If the user is connected, fetch their handle to pre-fill the input
  if (isMastodonConnected) {
    try {
      const masto = await getAuthenticatedMastoClient();
      if (masto) {
        const account = await masto.v1.accounts.verifyCredentials();
        mastodonUserHandle = `@${account.acct}`;
      }
    } catch (error) {
      console.error('Mastodon auth error:', error);
      // Continue without Mastodon user handle
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-12 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800">All My Posts</h1>
          <p className="mt-2 text-lg text-gray-500">View, search, and export feeds from Bluesky and Mastodon.</p>
        </div>
        <SmartSearch
          isMastodonConnected={isMastodonConnected}
          initialMastodonHandle={mastodonUserHandle}
        />
        <MastodonAuth
          isConnected={isMastodonConnected}
          userHandle={mastodonUserHandle}
        />
      </div>
      <footer className="mt-12 text-center text-gray-500">
        
        <div className="flex justify-center gap-4 mt-2">
          <a href="https://github.com/CrispStrobe/allmyposts" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800">
            <Github/>
          </a>
        </div>
      </footer>
    </main>
  );
}