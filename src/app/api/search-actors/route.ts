// src/app/api/search-actors/route.ts
import { getAuthenticatedAgent } from '@/lib/bsky-agent';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { term, platform } = await request.json();

    if (!term) {
      return NextResponse.json({ actors: [] });
    }

    // For now, we only support search for Bluesky as Mastodon search is instance-specific
    if (platform === 'bluesky') {
        const agent = await getAuthenticatedAgent();
        const response = await agent.api.app.bsky.actor.searchActors({
          term: term,
          limit: 8,
        });
        return NextResponse.json({ actors: response.data.actors });
    }

    return NextResponse.json({ actors: [] });

  } catch (error) {
    const e = error as Error;
    console.error('Actor Search API Route Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}