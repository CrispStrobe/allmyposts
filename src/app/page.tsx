// src/app/page.tsx
export const dynamic = 'force-dynamic';

import SmartSearch from '@/components/SmartSearch';
import MastodonAuth from '@/components/MastodonAuth';
import { Github, Rss } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getAuthenticatedMastoClient } from '@/lib/mastodon-agent';
import Link from 'next/link';

export default async function HomePage() {
  const session = await getSession();
  const isMastodonConnected = !!session.isLoggedIn && !!session.mastodon?.accessToken;
  let mastodonUserHandle: string | undefined = undefined;

  if (isMastodonConnected) {
    try {
        const masto = await getAuthenticatedMastoClient();
        if (masto) {
        const account = await masto.v1.accounts.verifyCredentials();
        mastodonUserHandle = `@${account.acct}`;
        }
    } catch (error) {
        console.error("Could not fetch Mastodon handle for home page:", error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-12 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800">All My Posts</h1>
          <p className="mt-2 text-lg text-gray-500">View, search, and export feeds from Bluesky and Mastodon.</p>
        </div>

        <div className="text-center mb-8">
          <Link href="/search" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline">
            <Rss className="w-5 h-5" />
            <span>Try the Personalized Network Search</span>
          </Link>
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
        <p>Inspired by the original `allmytweets`.</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="https://github.com/CrispStrobe/allmyposts" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800"><Github/></a>
        </div>
      </footer>
    </main>
  );
}