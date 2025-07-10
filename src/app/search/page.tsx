// src/app/search/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowLeft, Rss } from 'lucide-react';
import FollowsSearchClient from '@/components/FollowsSearchClient';
import { getSession } from '@/lib/session';
import { getAuthenticatedMastoClient } from '@/lib/mastodon-agent';

export default async function SearchPage() {
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
            console.error("Could not fetch Mastodon handle for search page:", error);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-12 bg-gray-50">
            <div className="w-full max-w-2xl">
                <div className="mb-6">
                    <Link href="/" className="text-blue-500 hover:underline mb-4 inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </div>
                <div className="text-center mb-8">
                    <Rss className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Network Search</h1>
                    <p className="mt-2 text-lg text-gray-500">Search for posts from accounts you follow on Bluesky and/or Mastodon.</p>
                </div>
                
                <FollowsSearchClient
                    isMastodonConnected={isMastodonConnected}
                    mastodonUserHandle={mastodonUserHandle}
                />
            </div>
        </main>
    );
}