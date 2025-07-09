// src/app/api/feed/route.ts
import { getAuthenticatedAgent as getBlueskyAgent } from '@/lib/bsky-agent';
import { MastodonAgent, getAuthenticatedMastoClient } from '@/lib/mastodon-agent';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { handle, cursor, platform, feedType, hideReplies, hideReposts } = await request.json();

    if (platform === 'bluesky') {
        const agent = await getBlueskyAgent();
        let response;
        if (feedType === 'likes') {
            response = await agent.api.app.bsky.feed.getActorLikes({ actor: handle, limit: 50, cursor });
        } else {
            const filter = hideReplies ? 'posts_no_replies' : 'posts_with_replies';
            response = await agent.api.app.bsky.feed.getAuthorFeed({ actor: handle, limit: 50, cursor, filter });
        }
        return NextResponse.json(response.data);

    } else if (platform === 'mastodon') {
        let posts;
        if (feedType === 'likes' || feedType === 'bookmarks') {
            const masto = await getAuthenticatedMastoClient();
            if (!masto) { throw new Error('Not authenticated with Mastodon.'); }

            const paginationParams = { limit: 40, maxId: cursor };
            posts = feedType === 'likes'
                ? await masto.v1.favourites.list(paginationParams)
                : await masto.v1.bookmarks.list(paginationParams);
        } else {
            if (!handle) return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
            const agent = new MastodonAgent(handle);
            const account = await agent.getAccountByHandle(handle);
            posts = await agent.getAccountStatuses(account.id, cursor, hideReplies, hideReposts);
        }
        
        const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : undefined;
        return NextResponse.json({ feed: posts, cursor: nextCursor });
    }

    return NextResponse.json({ error: 'Invalid platform specified' }, { status: 400 });

  } catch (error) {
    const e = error as Error;
    console.error('API Route Error:', e);
    return NextResponse.json({ error: 'Internal Server Error', message: e.message }, { status: 500 });
  }
}