// src/components/FollowsSearchClient.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Search, RefreshCw } from 'lucide-react';
import Post from './Post';
import { UnifiedPost } from '@/lib/types';
import { type mastodon } from 'masto';
import { type AppBskyFeedDefs } from '@atproto/api';

interface FollowsSearchClientProps {
    isMastodonConnected: boolean;
    mastodonUserHandle?: string;
}

interface AffinityCache {
    index: string[];
    expires: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const AFFINITY_PAGE_LIMIT = 15;

export default function FollowsSearchClient({ isMastodonConnected, mastodonUserHandle }: FollowsSearchClientProps) {
    const [bskyHandle, setBskyHandle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('bestMatch');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<UnifiedPost[]>([]);
    const [error, setError] = useState('');
    
    const [isBuildingIndex, setIsBuildingIndex] = useState(false);
    const [affinityProgress, setAffinityProgress] = useState('');
    const [affinityIndex, setAffinityIndex] = useState<{ bsky: Set<string>; masto: Set<string> }>({ bsky: new Set(), masto: new Set() });

    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const loadFromCache = (platform: 'bsky' | 'masto', handle: string) => {
            const key = `affinity-${platform}-${handle}`;
            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const data: AffinityCache = JSON.parse(cached);
                    if (data.expires > Date.now()) {
                        setAffinityIndex(prev => ({ ...prev, [platform]: new Set(data.index) }));
                    }
                }
            } catch (e) {
                console.error("Failed to load affinity cache from localStorage:", e);
                localStorage.removeItem(key);
            }
        };
        if (bskyHandle) loadFromCache('bsky', bskyHandle);
        if (mastodonUserHandle) loadFromCache('masto', mastodonUserHandle);
    }, [bskyHandle, mastodonUserHandle]);

    const buildAffinityIndex = useCallback(async () => {
        setIsBuildingIndex(true);
        setAffinityProgress('Starting index build...');
        
        const bskyAuthors = new Set<string>();
        const mastoAuthors = new Set<string>();

        try {
            if (bskyHandle) {
                let cursor: string | undefined;
                let fetchedCount = 0;
                setAffinityProgress(`Fetching Bluesky likes for ${bskyHandle}...`);
                for (let i = 0; i < AFFINITY_PAGE_LIMIT; i++) {
                    // FIX: Use POST method with a request body
                    const res = await fetch('/api/feed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platform: 'bluesky',
                            feedType: 'likes',
                            handle: bskyHandle,
                            cursor: cursor
                        })
                    });
                    if (!res.ok) throw new Error('Failed to fetch Bluesky likes.');
                    const data = await res.json();
                    const feed = data.feed as AppBskyFeedDefs.FeedViewPost[];
                    if (!feed || feed.length === 0) break;
                    
                    fetchedCount += feed.length;
                    setAffinityProgress(`Fetched ${fetchedCount.toLocaleString()} Bluesky likes...`);
                    feed.forEach(item => bskyAuthors.add(item.post.author.did));
                    cursor = data.cursor;
                    if (!cursor) break;
                }
                const key = `affinity-bsky-${bskyHandle}`;
                localStorage.setItem(key, JSON.stringify({ index: Array.from(bskyAuthors), expires: Date.now() + CACHE_TTL_MS }));
            }
            
            if (isMastodonConnected) {
                let cursor: string | undefined;
                let fetchedCount = 0;
                setAffinityProgress(`Fetching Mastodon favorites...`);
                for (let i = 0; i < AFFINITY_PAGE_LIMIT; i++) {
                    // FIX: Use POST method with a request body
                    const res = await fetch('/api/feed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platform: 'mastodon',
                            feedType: 'likes',
                            cursor: cursor
                        })
                    });
                    if (!res.ok) throw new Error('Failed to fetch Mastodon favorites.');
                    const data = await res.json();
                    const feed = data.feed as mastodon.v1.Status[];
                    if (!feed || feed.length === 0) break;

                    fetchedCount += feed.length;
                    setAffinityProgress(`Fetched ${fetchedCount.toLocaleString()} Mastodon favorites...`);
                    feed.forEach(status => mastoAuthors.add(status.account.id));
                    cursor = data.cursor;
                    if (!cursor) break;
                }
                if (mastodonUserHandle) {
                    const key = `affinity-masto-${mastodonUserHandle}`;
                    localStorage.setItem(key, JSON.stringify({ index: Array.from(mastoAuthors), expires: Date.now() + CACHE_TTL_MS }));
                }
            }
            
            setAffinityIndex({ bsky: bskyAuthors, masto: mastoAuthors });
            setAffinityProgress('Personalized ranker updated and cached for 1 hour!');
        } catch (e) {
            setAffinityProgress(`Error building index: ${(e as Error).message}`);
        } finally {
            setIsBuildingIndex(false);
        }
    }, [bskyHandle, isMastodonConnected, mastodonUserHandle]);
    
    const handleSearch = () => {
        if (!searchQuery) { setError('Please enter a search phrase.'); return; }
        if (!bskyHandle && !isMastodonConnected) { setError('Please provide a Bluesky handle or connect a Mastodon account to search.'); return; }
        if (eventSourceRef.current) eventSourceRef.current.close();

        setIsLoading(true);
        setError('');
        setResults([]);
        
        const allPosts: UnifiedPost[] = [];
        const params = new URLSearchParams({ searchQuery });
        if (bskyHandle) params.set('bskyHandle', bskyHandle);

        const eventSource = new EventSource(`/api/network-search-stream?${params.toString()}`);
        eventSourceRef.current = eventSource;
        
        eventSource.addEventListener('post', (e: MessageEvent) => {
            allPosts.push(JSON.parse(e.data));
        });
        
        eventSource.addEventListener('error', (e: MessageEvent) => {
            const data = e.data ? JSON.parse(e.data) : { message: 'An unknown streaming error occurred.' };
            setError(data.message);
            eventSource.close();
            setIsLoading(false);
        });

        eventSource.addEventListener('close', () => {
            eventSource.close();
            eventSourceRef.current = null;
            
            const sortedPosts = allPosts.sort((a, b) => {
                if (sortBy === 'bestMatch') {
                    const scoreA = (a.platform === 'bluesky' && affinityIndex.bsky.has(a.raw.post.author.did) ? 1000 : 0) + 
                                 (a.platform === 'mastodon' && affinityIndex.masto.has(a.raw.account.id) ? 1000 : 0) + 
                                 (a.likeCount ?? 0) + ((a.repostCount ?? 0) * 2);
                    const scoreB = (b.platform === 'bluesky' && affinityIndex.bsky.has(b.raw.post.author.did) ? 1000 : 0) +
                                 (b.platform === 'mastodon' && affinityIndex.masto.has(b.raw.account.id) ? 1000 : 0) +
                                 (b.likeCount ?? 0) + ((b.repostCount ?? 0) * 2);
                    if (scoreA !== scoreB) return scoreB - scoreA;
                }
                if (sortBy === 'likes') {
                    const likeDiff = (b.likeCount ?? 0) - (a.likeCount ?? 0);
                    if (likeDiff !== 0) return likeDiff;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            setResults(sortedPosts);
            setIsLoading(false);
        });
    };

    useEffect(() => { return () => { if (eventSourceRef.current) eventSourceRef.current.close(); }; }, []);
    
    return (
        <div>
            <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Phrase</label>
                        <input
                            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="e.g., European politics" disabled={isLoading || isBuildingIndex}
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                    <div className="md:w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
                        <select
                            value={sortBy} onChange={(e) => setSortBy(e.target.value)} disabled={isLoading || isBuildingIndex}
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        >
                            <option value="bestMatch">Best Match (Personalized)</option>
                            <option value="newest">Newest First</option>
                            <option value="likes">Most Likes</option>
                        </select>
                    </div>
                </div>
                <div className="pt-4 border-t border-gray-200 space-y-4">
                    <p className="text-sm text-gray-600">Filter by accounts followed by:</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bluesky Handle</label>
                        <input
                            type="text" value={bskyHandle} onChange={(e) => setBskyHandle(e.target.value)}
                            placeholder="e.g., bsky.app" disabled={isLoading || isBuildingIndex}
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mastodon Account</label>
                        {isMastodonConnected ? (
                            <div className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-md text-gray-700">
                                Connected as <span className="font-semibold">{mastodonUserHandle}</span>
                            </div>
                        ) : (
                            <div className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-md text-gray-500">
                                Connect on the home page to enable Mastodon search.
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-md">
                        <label className="block text-sm font-medium text-gray-700">Personalized Ranker</label>
                        <p className="text-xs text-gray-500 mb-2">Builds an index of authors you&apos;ve liked to improve &quot;Best Match&quot; sorting. Cached in your browser for 1 hour.</p>
                        <button
                            onClick={buildAffinityIndex} disabled={isBuildingIndex || (!bskyHandle && !isMastodonConnected)}
                            className="w-full text-sm px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                            {isBuildingIndex ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                            {isBuildingIndex ? 'Building...' : 'Build / Refresh Ranker'}
                        </button>
                        {affinityProgress && <p className="text-xs text-center text-gray-600 mt-2">{affinityProgress}</p>}
                        <div className="grid grid-cols-2 text-center mt-2">
                            <p className="text-xs text-gray-500">Bluesky Authors: <strong>{affinityIndex.bsky.size.toLocaleString()}</strong></p>
                            <p className="text-xs text-gray-500">Mastodon Authors: <strong>{affinityIndex.masto.size.toLocaleString()}</strong></p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <button
                    onClick={handleSearch} disabled={isLoading || isBuildingIndex}
                    className="w-full px-6 py-4 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Search Follows
                </button>
                {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            </div>
            
            <div className="mt-8">
                {isLoading && <div className="text-center py-4"><Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin" /></div>}
                {!isLoading && results.length > 0 && <p className="text-sm text-center text-gray-600 mb-4">Search complete. Showing {results.length} results.</p>}
                <div className="space-y-6">
                    {results.map(post => <Post key={`${post.platform}-${post.uri}`} post={post} />)}
                </div>
                {!isLoading && !error && results.length === 0 && !isBuildingIndex && (
                    <p className="text-center text-gray-500 mt-4">Enter a query and click search to begin, or build the ranker first.</p>
                )}
            </div>
        </div>
    );
}