// src/app/posts/page.tsx
export const dynamic = 'force-dynamic';

import { type AppBskyActorDefs, type AppBskyFeedDefs } from '@atproto/api';
import { getAuthenticatedAgent } from '@/lib/bsky-agent';
import { MastodonAgent, type MastodonPost, getAuthenticatedMastoClient } from '@/lib/mastodon-agent';
import Link from 'next/link';
import Image from 'next/image';
import PostManager from '@/components/PostManager';
import { ArrowLeft, WifiOff } from 'lucide-react';
import { type MastodonProfile } from '@/lib/types';

// Type definitions

type SuccessResult = {
    platform: 'bluesky' | 'mastodon';
    profile: AppBskyActorDefs.ProfileViewDetailed | MastodonProfile;
    feed: AppBskyFeedDefs.FeedViewPost[] | MastodonPost[];
    cursor?: string;
};

type FailureResult = {
    status: 'rejected';
    reason: Error;
    platform: string;
};

type FeedType = 'posts' | 'likes' | 'bookmarks';

// This function now handles fetching posts, likes, and bookmarks
async function getInitialDataForPlatform(platform: 'bluesky' | 'mastodon', handle: string, includeReplies: boolean, feedType: FeedType): Promise<SuccessResult> {
    if (platform === 'bluesky') {
        const agent = await getAuthenticatedAgent();
        const profileRes = await agent.api.app.bsky.actor.getProfile({ actor: handle });
        let feedRes;
        if (feedType === 'likes') {
            feedRes = await agent.api.app.bsky.feed.getActorLikes({ actor: handle, limit: 50 });
        } else {
            const filter = includeReplies ? 'posts_with_replies' : 'posts_no_replies';
            feedRes = await agent.api.app.bsky.feed.getAuthorFeed({ actor: handle, limit: 50, filter });
        }
        return { platform, profile: profileRes.data, feed: feedRes.data.feed, cursor: feedRes.data.cursor };
    } else { // Mastodon
        if (feedType === 'likes' || feedType === 'bookmarks') {
            const masto = await getAuthenticatedMastoClient();
            if (!masto) { throw new Error('You must be connected to Mastodon to view this feed.'); }
            const account = await masto.v1.accounts.verifyCredentials();
            const posts = feedType === 'likes'
                ? await masto.v1.favourites.list({ limit: 40 })
                : await masto.v1.bookmarks.list({ limit: 40 });
            const profile: MastodonProfile = { displayName: account.displayName, handle: `@${account.acct}`, avatar: account.avatar, description: account.note };
            const cursor = posts.length > 0 ? posts[posts.length - 1].id : undefined;
            return { platform, profile, feed: posts, cursor };
        } else {
            const agent = new MastodonAgent(handle);
            const account = await agent.getAccountByHandle(handle);
            const posts = await agent.getAccountStatuses(account.id, undefined, !includeReplies, false);
            const profile: MastodonProfile = { 
                displayName: account.displayName, handle, avatar: account.avatar, 
                description: account.note, followersCount: account.followersCount, 
                followsCount: account.followingCount, postsCount: account.statusesCount
            };
            const cursor = posts.length > 0 ? posts[posts.length - 1].id : undefined;
            return { platform, profile, feed: posts, cursor };
        }
    }
}

interface PageProps {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined; }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams ?? {};

  const bskyHandle = resolvedSearchParams.bsky as string | undefined;
  const mastodonHandle = resolvedSearchParams.mastodon as string | undefined;
  
  const bskyFeedType = (resolvedSearchParams.bsky_feed === 'likes') ? 'likes' : 'posts';
  const mastodonFeedType = (resolvedSearchParams.mastodon_feed as FeedType) || 'posts';

  if (!bskyHandle && !mastodonHandle) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <WifiOff className="w-16 h-16 mx-auto text-gray-400 mb-4"/>
            <h1 className="text-2xl font-bold text-gray-700">No Account Specified</h1>
            <p className="text-gray-500 mt-2">Please go back and enter a handle.</p>
            <Link href="/" className="inline-flex items-center gap-2 mt-6 text-blue-500 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to Search
            </Link>
        </main>
    );
  }
  
  const includeReplies = resolvedSearchParams.replies !== 'false';
  const hideReposts = resolvedSearchParams.hideReposts === 'true';  
  const initialHideMedia = resolvedSearchParams.hideMedia === 'true';

  const fetchPromises: Promise<SuccessResult | FailureResult>[] = [];
  if (bskyHandle) fetchPromises.push(getInitialDataForPlatform('bluesky', bskyHandle, includeReplies, bskyFeedType).catch(e => ({ status: 'rejected', reason: e as Error, platform: 'bluesky' })));
  if (mastodonHandle) fetchPromises.push(getInitialDataForPlatform('mastodon', mastodonHandle, includeReplies, mastodonFeedType).catch(e => ({ status: 'rejected', reason: e as Error, platform: 'mastodon' })));

  const results = await Promise.all(fetchPromises);
  
  const successfulResults = results.filter((result): result is SuccessResult => 'profile' in result);
  const failedResults = results.filter((result): result is FailureResult => 'status' in result && result.status === 'rejected');

  if (successfulResults.length === 0) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600">Error Fetching Feed</h1>
            {failedResults.length > 0 && (
                <div className="mt-4 text-left md:w-1/2 mx-auto">
                    {failedResults.map((failure, i) => (
                      <div key={i} className="mt-2 bg-red-50 p-3 rounded-md border border-red-200">
                          <p className="font-semibold text-red-800">Could not fetch from {failure.platform}:</p>
                          <p className="text-sm text-red-700 mt-1">{failure.reason.message}</p>
                      </div>
                    ))}
                </div>
            )}
            <Link href="/" className="inline-flex items-center gap-2 mt-6 text-blue-500 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to Search
            </Link>
        </main>
    );
  }

  const profiles = successfulResults.map(res => ({ ...res.profile, platform: res.platform }));
  const initialData = {
      bluesky: successfulResults.find(r => r.platform === 'bluesky'),
      mastodon: successfulResults.find(r => r.platform === 'mastodon'),
  };

  return (
    <main className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <Link href="/" className="text-blue-500 hover:underline mb-4 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>
        
        {profiles.map(profile => (
          <div key={profile.handle} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-4">
              <div className="flex items-start gap-6">
                  <Image src={profile.avatar ?? '/default-avatar.png'} alt={profile.displayName ?? ''} width={80} height={80} className="rounded-full bg-gray-100" />
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                          <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate">{profile.displayName}</h1>
                          {profile.platform === 'bluesky' ? <Image src="/bluesky-logo.svg" alt="Bluesky" width={20} height={20} /> : <Image src="/mastodon-logo.svg" alt="Mastodon" width={20} height={20} />}
                      </div>
                      <p className="text-gray-500 text-base md:text-lg break-all">@{profile.handle}</p>
                      
                      {profile.description && (
                        <div className="mt-2 text-gray-700 text-sm prose prose-sm max-w-none break-words">
                            {profile.platform === 'mastodon' ? (
                                <div dangerouslySetInnerHTML={{ __html: profile.description }} />
                            ) : (
                                <p>{profile.description}</p>
                            )}
                        </div>
                      )}
                  </div>
              </div>
          </div>
        ))}
      </div>
      
      <PostManager
        initialData={JSON.parse(JSON.stringify(initialData))}
        initialHideMedia={initialHideMedia}
        initialHideReposts={hideReposts}
        initialIncludeReplies={includeReplies}
        // Pass down the feed types for each platform for pagination
        feedTypes={{
          bluesky: bskyFeedType,
          mastodon: mastodonFeedType
        }}
      />
    </main>
  );
}