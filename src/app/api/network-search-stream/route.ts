import { NextRequest } from 'next/server';
import { getAuthenticatedAgent } from '@/lib/bsky-agent';
import { getAuthenticatedMastoClient } from '@/lib/mastodon-agent';
import { normalizePost } from '@/lib/utils';
import { BskyAgent, type Did } from '@atproto/api';
import { UnifiedPost } from '@/lib/types';

const SEARCH_PAGE_LIMIT = 5;

type MessageEventData = { message: string };
type PostEventData = UnifiedPost;
type SummaryEventData = { bskyFollows: number; bskyInitialPosts: number; mastoInitialPosts: number; };
type StreamEventData = MessageEventData | PostEventData | SummaryEventData;

// A simple helper to send events
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: StreamEventData) {
    try {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch(e) {
        console.error("Failed to send event:", e);
    }
}

// Helper to get all accounts a user follows on Bluesky
async function getAllFollows(agent: BskyAgent, actor: string): Promise<Set<Did>> {
    const follows = new Set<Did>();
    let cursor: string | undefined;
    try {
        do {
            const res = await agent.api.app.bsky.graph.getFollows({ actor, cursor, limit: 100 });
            res.data.follows.forEach(follow => follows.add(follow.did as Did));
            cursor = res.data.cursor;
        } while (cursor);
    } catch (error) { console.warn(`Could not fetch follows for ${actor}:`, error) }
    return follows;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const bskyHandle = searchParams.get('bskyHandle');
    const searchQuery = searchParams.get('searchQuery');

    if (!searchQuery) return new Response("Search query is required", { status: 400 });

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const searchPromises: Promise<void>[] = [];

                if (bskyHandle) {
                    searchPromises.push((async () => {
                        const agent = await getAuthenticatedAgent();
                        const followedDids = await getAllFollows(agent, bskyHandle);
                        let cursor: string | undefined;
                        for (let i = 0; i < SEARCH_PAGE_LIMIT; i++) {
                            const searchRes = await agent.api.app.bsky.feed.searchPosts({ q: searchQuery, limit: 100, cursor });
                            const filteredPosts = searchRes.data.posts.filter(post => followedDids.has(post.author.did as Did));
                            for (const post of filteredPosts) {
                                sendEvent(controller, 'post', normalizePost({ post }, 'bluesky'));
                            }
                            cursor = searchRes.data.cursor;
                            if (!cursor) break;
                        }
                    })());
                }

                const mastoClient = await getAuthenticatedMastoClient();
                if (mastoClient) {
                    searchPromises.push((async () => {
                        const paginator = mastoClient.v2.search.list({ q: searchQuery, type: 'statuses', following: true, limit: 40 });
                        let pagesFetched = 0;
                        for await (const page of paginator) {
                            for (const status of page.statuses) {
                                sendEvent(controller, 'post', normalizePost(status, 'mastodon'));
                            }
                            pagesFetched++;
                            if (pagesFetched >= SEARCH_PAGE_LIMIT) break;
                        }
                    })());
                }

                await Promise.allSettled(searchPromises);
            } catch (e) {
                sendEvent(controller, 'error', { message: (e as Error).message });
            } finally {
                sendEvent(controller, 'close', { message: 'Search stream complete.' });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
}