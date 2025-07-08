// src/app/api/feed/route.ts
import { getAuthenticatedAgent as getBlueskyAgent } from '@/lib/bsky-agent';
import { MastodonAgent } from '@/lib/mastodon-agent';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Standardize on hideReplies and hideReposts for all platforms
    const { handle, cursor, platform, hideReplies, hideReposts } = await request.json();

    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    if (platform === 'bluesky') {
        const agent = await getBlueskyAgent();
        const response = await agent.api.app.bsky.feed.getAuthorFeed({
          actor: handle,
          limit: 50,
          cursor,
          // Use the standardized flag to set the platform-specific filter
          filter: hideReplies ? 'posts_no_replies' : 'posts_with_replies',
        });
        return NextResponse.json(response.data);

    } else if (platform === 'mastodon') {
        const agent = new MastodonAgent(handle);
        const account = await agent.getAccountByHandle(handle);
        if (!account) throw new Error('Mastodon account not found');
        
        // Pass the standardized flags to the agent method
        const posts = await agent.getAccountStatuses(account.id, cursor, hideReplies, hideReposts);
        const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : undefined;
        return NextResponse.json({ feed: posts, cursor: nextCursor });
    }

    return NextResponse.json({ error: 'Invalid platform specified' }, { status: 400 });

  } catch (error) {
    const e = error as Error;
    console.error('API Route Error:', e);
    // Add more context to the returned error
    return NextResponse.json({ error: 'Internal Server Error', message: e.message }, { status: 500 });
  }
}