// src/app/api/network-search/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAgent } from '@/lib/bsky-agent';
import { getAuthenticatedMastoClient } from '@/lib/mastodon-agent';
import { normalizePost } from '@/lib/utils';
import { UnifiedPost } from '@/lib/types';
import { BskyAgent, type Did } from '@atproto/api';
import { type mastodon } from 'masto';

const SEARCH_PAGE_LIMIT = 5; // The number of pages to fetch from each platform's search results.

/**
 * Fetches all posts a user has liked on Bluesky to build an index of preferred authors.
 */
async function getBlueskyAffinity(agent: BskyAgent, actor: string): Promise<Set<Did>> {
    const likedAuthors = new Set<Did>();
    let cursor: string | undefined;
    try {
        do {
            const res = await agent.api.app.bsky.feed.getActorLikes({ actor, cursor, limit: 100 });
            res.data.feed.forEach(item => likedAuthors.add(item.post.author.did as Did));
            cursor = res.data.cursor;
        } while (cursor);
    } catch (error) {
        console.warn(`Could not fetch full like history for ${actor}:`, error);
    }
    return likedAuthors;
}

/**
 * Fetches all posts a user has favorited on Mastodon to build an index of preferred authors.
 */
async function getMastodonAffinity(masto: mastodon.rest.Client): Promise<Set<string>> {
    const favoritedAuthors = new Set<string>();
    let maxId: string | undefined;
    try {
        while (true) {
            const page: mastodon.v1.Status[] = await masto.v1.favourites.list({ limit: 40, maxId });
            if (page.length === 0) break;
            page.forEach(status => favoritedAuthors.add(status.account.id));
            maxId = page[page.length - 1].id;
        }
    } catch (error) {
        console.warn(`Could not fetch full favorite history from Mastodon:`, error);
    }
    return favoritedAuthors;
}


export async function POST(req: NextRequest) {
    try {
        const { bskyHandle, searchQuery, sortBy } = await req.json();

        if (!searchQuery) {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        // --- Stats Initialization ---
        const stats = {
            bskyFollows: 0,
            bskyInitialPosts: 0,
            mastoInitialPosts: 0,
        };

        let affinityIndex: { bsky: Set<Did>; masto: Set<string> } = { bsky: new Set(), masto: new Set() };

        if (sortBy === 'bestMatch') {
            const affinityPromises = [];
            if (bskyHandle) {
                const agent = await getAuthenticatedAgent();
                affinityPromises.push(getBlueskyAffinity(agent, bskyHandle));
            } else {
                affinityPromises.push(Promise.resolve(new Set<Did>()));
            }

            const masto = await getAuthenticatedMastoClient();
            if (masto) {
                affinityPromises.push(getMastodonAffinity(masto));
            } else {
                affinityPromises.push(Promise.resolve(new Set<string>()));
            }
            const [bskyAffinities, mastoAffinities] = await Promise.all(affinityPromises);
            affinityIndex = { bsky: bskyAffinities as Set<Did>, masto: mastoAffinities as Set<string> };
        }
        
        const promises: Promise<UnifiedPost[]>[] = [];

        // --- Bluesky Search Promise with Pagination ---
        if (bskyHandle) {
            const bskyPromise = (async () => {
                const agent = await getAuthenticatedAgent();
                const followedDids = await getAllFollows(agent, bskyHandle);
                stats.bskyFollows = followedDids.size;

                let cursor: string | undefined;
                const allFoundPosts: UnifiedPost[] = [];
                
                for (let i = 0; i < SEARCH_PAGE_LIMIT; i++) {
                    const searchRes = await agent.api.app.bsky.feed.searchPosts({ q: searchQuery, limit: 50, cursor });
                    stats.bskyInitialPosts += searchRes.data.posts.length;
                    
                    const filteredPosts = searchRes.data.posts
                        .filter(post => followedDids.has(post.author.did as Did))
                        .map(p => normalizePost({ post: p }, 'bluesky'));
                    
                    allFoundPosts.push(...filteredPosts);

                    cursor = searchRes.data.cursor;
                    if (!cursor) break; // Stop if there are no more pages
                }
                return allFoundPosts;
            })();
            promises.push(bskyPromise);
        }

        // --- Mastodon Search Promise with Pagination ---
        const mastoClient = await getAuthenticatedMastoClient();
        if (mastoClient) {
            const mastoPromise = (async () => {
                const paginator = mastoClient.v2.search.list({
                    q: searchQuery,
                    type: 'statuses',
                    following: true,
                    limit: 40,
                });

                const allFoundPosts: UnifiedPost[] = [];
                let pagesFetched = 0;

                for await (const page of paginator) {
                    stats.mastoInitialPosts += page.statuses.length;
                    const normalized = page.statuses.map((s: mastodon.v1.Status) => normalizePost(s, 'mastodon'));
                    allFoundPosts.push(...normalized);

                    pagesFetched++;
                    if (pagesFetched >= SEARCH_PAGE_LIMIT) break; // Stop after N pages
                }
                return allFoundPosts;
            })();
            promises.push(mastoPromise);
        }

        // --- Execute, Score, and Sort ---

        const results = await Promise.allSettled(promises);
        const allPosts: UnifiedPost[] = results
            .filter(res => res.status === 'fulfilled')
            .flatMap(res => (res as PromiseFulfilledResult<UnifiedPost[]>).value);

        const sortedPosts = allPosts.sort((a, b) => {
            if (sortBy === 'bestMatch') {
                const scoreA = (a.platform === 'bluesky' && affinityIndex.bsky.has(a.raw.post.author.did as Did) ? 1000 : 0) + 
                             (a.platform === 'mastodon' && affinityIndex.masto.has(a.raw.account.id) ? 1000 : 0) + 
                             (a.likeCount ?? 0) + ((a.repostCount ?? 0) * 2);
                const scoreB = (b.platform === 'bluesky' && affinityIndex.bsky.has(b.raw.post.author.did as Did) ? 1000 : 0) +
                             (b.platform === 'mastodon' && affinityIndex.masto.has(b.raw.account.id) ? 1000 : 0) +
                             (b.likeCount ?? 0) + ((b.repostCount ?? 0) * 2);
                return scoreB - scoreA;
            }
            if (sortBy === 'likes') {
                return (b.likeCount ?? 0) - (a.likeCount ?? 0);
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Return both the posts and the stats object
        return NextResponse.json({ posts: sortedPosts, stats });

    } catch (error) {
        console.error("Network search error:", error);
        return NextResponse.json({ error: 'Failed to perform search.' }, { status: 500 });
    }
}

async function getAllFollows(agent: BskyAgent, actor: string): Promise<Set<Did>> {
    const follows = new Set<Did>();
    let cursor: string | undefined;
    do {
        const res = await agent.api.app.bsky.graph.getFollows({ actor, cursor, limit: 100 });
        res.data.follows.forEach(follow => follows.add(follow.did as Did));
        cursor = res.data.cursor;
    } while (cursor);
    return follows;
}