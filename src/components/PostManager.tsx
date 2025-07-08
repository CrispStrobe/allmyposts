// src/components/PostManager.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { type mastodon } from 'masto';
import { AppBskyActorDefs, AppBskyFeedDefs, AppBskyEmbedImages } from '@atproto/api';
import jaroWinkler from 'jaro-winkler';
import AdvancedFilters, { type Filters } from './AdvancedFilters';
import AnalyticsDashboard from './AnalyticsDashboard';
import ExportManager from './ExportManager';
import PostThread from './PostThread';
import Post from './Post';
import { Loader2 } from 'lucide-react';

// UnifiedPost as a Discriminated Union for better type safety.
// This creates a base type and then extends it for each platform.
interface UnifiedPostBase {
  uri: string;
  text: string;
  author: { handle: string; displayName?: string; avatar?: string; };
  createdAt: string;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  replyParentUri?: string;
  isRepost: boolean;
  repostAuthor?: { handle: string; displayName?: string; };
}

interface BlueskyUnifiedPost extends UnifiedPostBase {
  platform: 'bluesky';
  embeds?: AppBskyFeedDefs.PostView['embed'];
  raw: AppBskyFeedDefs.FeedViewPost;
}

interface MastodonUnifiedPost extends UnifiedPostBase {
  platform: 'mastodon';
  embeds?: mastodon.v1.MediaAttachment[];
  raw: mastodon.v1.Status;
}

export type UnifiedPost = BlueskyUnifiedPost | MastodonUnifiedPost;

export interface CrosspostGroup {
    type: 'crosspost';
    id: string;
    posts: UnifiedPost[];
    similarity: number;
}

type FeedItem = UnifiedPost | CrosspostGroup;
type PlatformPost = AppBskyFeedDefs.FeedViewPost | mastodon.v1.Status;

interface FeedApiResponse {
  feed: PlatformPost[];
  cursor?: string;
  error?: string;
}

const normalizePost = (post: PlatformPost, platform: 'bluesky' | 'mastodon'): UnifiedPost => {
    if (platform === 'bluesky') {
        const item = post as AppBskyFeedDefs.FeedViewPost;
        const p = item.post;
        const record = p.record as { text: string; createdAt: string; reply?: { parent: { uri: string } } };
        return {
            uri: p.uri, text: record.text, author: p.author, createdAt: record.createdAt,
            platform: 'bluesky', replyCount: p.replyCount, repostCount: p.repostCount,
            likeCount: p.likeCount, replyParentUri: record.reply?.parent.uri,
            isRepost: AppBskyFeedDefs.isReasonRepost(item.reason),
            repostAuthor: AppBskyFeedDefs.isReasonRepost(item.reason) ? item.reason.by : undefined,
            embeds: p.embed, raw: item,
        };
    } else { // Mastodon
        const item = post as mastodon.v1.Status;
        const target = item.reblog ?? item;
        return {
            uri: target.uri, text: target.content.replace(/<[^>]*>?/gm, ''),
            author: { handle: `@${target.account.acct}@${new URL(target.account.url).hostname}`, displayName: target.account.displayName, avatar: target.account.avatar, },
            createdAt: target.createdAt, platform: 'mastodon',  
            replyCount: target.repliesCount, repostCount: target.reblogsCount, likeCount: target.favouritesCount,
            replyParentUri: target.inReplyToId ?? undefined, isRepost: !!item.reblog,
            repostAuthor: item.reblog ? { handle: `@${item.account.acct}@${new URL(item.account.url).hostname}`, displayName: item.account.displayName } : undefined,
            embeds: target.mediaAttachments, raw: item,
        };
    }
};

interface PlatformData {
    profile: AppBskyActorDefs.ProfileViewDetailed | { handle: string };
    feed: PlatformPost[];
    cursor?: string;
}

interface InitialData {
    bluesky?: PlatformData;
    mastodon?: PlatformData;
}

interface PostManagerProps {
  initialData: InitialData;
  initialHideMedia: boolean;
  initialHideReposts: boolean;
  initialIncludeReplies: boolean;
}

export default function PostManager({ initialData, initialHideMedia, initialHideReposts, initialIncludeReplies }: PostManagerProps) {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [cursors, setCursors] = useState({ bluesky: initialData.bluesky?.cursor, mastodon: initialData.mastodon?.cursor });
  const [loadingStates, setLoadingStates] = useState({ bluesky: false, mastodon: false });
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const bskyPosts = initialData.bluesky?.feed.map(p => normalizePost(p, 'bluesky')) ?? [];
    const mastodonPosts = initialData.mastodon?.feed.map(p => normalizePost(p, 'mastodon')) ?? [];
    const combined = [...bskyPosts, ...mastodonPosts].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPosts(combined);
  }, [initialData]);

  const [filters, setFilters] = useState<Filters>({ searchTerm: '', sortBy: 'newest', hasMedia: false, hideReplies: !initialIncludeReplies, hideReposts: initialHideReposts, minLikes: 0 });
  const [hideMedia, setHideMedia] = useState(initialHideMedia);
  const [viewMode, setViewMode] = useState<'feed' | 'analytics'>('feed');

  const handleFilterChange = (newFilters: Partial<Filters>) => setFilters(prev => ({ ...prev, ...newFilters }));

  const loadMore = useCallback(async (platform: 'bluesky' | 'mastodon') => {
    const handle = initialData[platform]?.profile.handle;
    const cursor = cursors[platform];
    if (!cursor || !handle) return;
    setLoadingStates(prev => ({ ...prev, [platform]: true }));
    setError('');
    try {
        const payload = { handle, platform, cursor, hideReplies: filters.hideReplies, hideReposts: filters.hideReposts };
        const response = await fetch('/api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data: FeedApiResponse = await response.json();
        if (data.error) throw new Error(data.error);
        const newPosts = data.feed.map(p => normalizePost(p, platform));
        setPosts(prevPosts => {
            const existingUris = new Set(prevPosts.map(p => p.uri));
            const uniqueNewPosts = newPosts.filter(p => !existingUris.has(p.uri));
            return [...prevPosts, ...uniqueNewPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
        setCursors(prev => ({ ...prev, [platform]: data.cursor }));
    } catch (err) {
        const e = err as Error;
        setError(`Failed to load more from ${platform}: ${e.message}`);
    } finally {
        setLoadingStates(prev => ({ ...prev, [platform]: false }));
    }
  }, [cursors, initialData, filters]);

  const handleLoadAll = useCallback(async () => {
    setIsLoadingAll(true);
    setError('');
    const loadAllForPlatform = async (platform: 'bluesky' | 'mastodon') => {
        let currentCursor = cursors[platform];
        const handle = initialData[platform]?.profile.handle;
        if (!handle) return;
        while (currentCursor) {
            const payload = { handle, platform, cursor: currentCursor, hideReplies: filters.hideReplies, hideReposts: filters.hideReposts };
            try {
                const res = await fetch('/api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data: FeedApiResponse = await res.json();
                if (data.error) throw new Error(data.error);
                const newPosts = data.feed.map(p => normalizePost(p, platform));
                setPosts(prev => {
                    const existingUris = new Set(prev.map(p => p.uri));
                    const uniqueNewPosts = newPosts.filter(p => !existingUris.has(p.uri));
                    return [...prev, ...uniqueNewPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                });
                currentCursor = data.cursor;
                setCursors(prev => ({ ...prev, [platform]: data.cursor }));
            } catch (err) {
                setError(`Failed during 'Load All' for ${platform}: ${(err as Error).message}`);
                currentCursor = undefined;
            }
        }
    };
    const loadPromises = [];
    if (cursors.bluesky) loadPromises.push(loadAllForPlatform('bluesky'));
    if (cursors.mastodon) loadPromises.push(loadAllForPlatform('mastodon'));
    await Promise.all(loadPromises);
    setIsLoadingAll(false);
  }, [cursors, initialData, filters]);

  const finalFeed = useMemo((): FeedItem[] => {
      const filteredPosts = posts.filter(post => {
          if (filters.hideReplies && post.replyParentUri) return false;
          if (filters.hideReposts && post.isRepost) return false;
          if (filters.searchTerm && !post.text.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
          if (filters.hasMedia) {
              const hasBskyImages = post.platform === 'bluesky' && AppBskyEmbedImages.isView(post.embeds);
              const hasMastoImages = post.platform === 'mastodon' && Array.isArray(post.embeds) && post.embeds.some((att) => att.type === 'image');
              if (!hasBskyImages && !hasMastoImages) return false;
          }
          if (filters.minLikes > 0 && (post.likeCount ?? 0) < filters.minLikes) return false;
          return true;
      });

      const sortedPosts = [...filteredPosts].sort((a, b) => {
          switch (filters.sortBy) {
            case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'likes': return (b.likeCount ?? 0) - (a.likeCount ?? 0);
            case 'reposts': return (b.repostCount ?? 0) - (a.repostCount ?? 0);
            case 'engagement': return ((b.likeCount ?? 0) + (b.repostCount ?? 0)) - ((a.likeCount ?? 0) + (a.repostCount ?? 0));
            default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
      });
      
      const SIMILARITY_THRESHOLD = 0.9;
      const TIME_WINDOW_MS = 24 * 60 * 60 * 1000;
      const feedItems: FeedItem[] = [];
      const processedUris = new Set<string>();

      sortedPosts.forEach(post1 => {
        if (processedUris.has(post1.uri)) return;
        const potentialMatches = sortedPosts.filter(post2 => !processedUris.has(post2.uri) && post1.uri !== post2.uri && post1.platform !== post2.platform && Math.abs(new Date(post1.createdAt).getTime() - new Date(post2.createdAt).getTime()) < TIME_WINDOW_MS);
        let bestMatch: UnifiedPost | null = null;
        let bestScore = 0;
        potentialMatches.forEach(post2 => {
            const score = jaroWinkler(post1.text, post2.text);
            if (score > bestScore) { bestScore = score; bestMatch = post2; }
        });
        if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
            const allMatches = [post1, bestMatch].sort((a,b) => a.platform.localeCompare(b.platform));
            feedItems.push({ type: 'crosspost', posts: allMatches, id: post1.uri, similarity: bestScore });
            allMatches.forEach(p => processedUris.add(p.uri));
        } else {
            feedItems.push(post1);
            processedUris.add(post1.uri);
        }
    });

      const postsForThreading = feedItems.flatMap(item => ('posts' in item) ? [] : [item]);
      const postsByUri = new Map(postsForThreading.map(p => [p.uri, p]));
      const threadRoots = postsForThreading.filter(p => !p.replyParentUri || !postsByUri.has(p.replyParentUri));
      return feedItems.filter(item => 'posts' in item || threadRoots.some(root => 'uri' in item && root.uri === item.uri));
  }, [posts, filters]);
  
  const feedForExport = useMemo((): UnifiedPost[] => finalFeed.flatMap(item => 'posts' in item ? item.posts : item), [finalFeed]);
  const hasMoreContent = cursors.bluesky || cursors.mastodon;

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('feed')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${viewMode === 'feed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>Feed</button>
          <button onClick={() => setViewMode('analytics')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${viewMode === 'analytics' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>Analytics</button>
        </div>
        <ExportManager posts={feedForExport} handle={initialData.bluesky?.profile.handle || initialData.mastodon?.profile.handle || 'user'} />
      </div>

      {viewMode === 'analytics' && <AnalyticsDashboard posts={posts} />}
      {viewMode === 'feed' && (
        <>
          <AdvancedFilters filters={filters} onFiltersChange={handleFilterChange} />
          <div className="flex justify-end mb-4 -mt-4 mr-4">
            <label className="flex items-center gap-2 text-gray-700 cursor-pointer"><input type="checkbox" checked={hideMedia} onChange={(e) => setHideMedia(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Hide Media</label>
          </div>
          <div className="space-y-6">
            {finalFeed.map(item => {
              // FIXED: Use `in` operator as a type guard
              if ('posts' in item) {
                  return (
                      <div key={item.id} className="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg">
                          <h3 className="font-semibold text-indigo-800 mb-4">Crossposted Content<span className="text-sm font-normal text-indigo-600 ml-2">(Similarity: {(item.similarity * 100).toFixed(1)}%)</span></h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{item.posts.map((post) => (<Post key={post.uri} post={post} hideMedia={hideMedia} />))}</div>
                      </div>
                  );
              } else {
                  return <PostThread key={item.uri} post={item} allPosts={posts} hideMedia={hideMedia} />;
              }
            })}
          </div>
          {hasMoreContent && (
            <div className="text-center mt-8 flex flex-wrap items-center justify-center gap-4">
              {cursors.bluesky && <button onClick={() => loadMore('bluesky')} disabled={loadingStates.bluesky || isLoadingAll} className="px-5 py-2 font-semibold text-white bg-sky-500 rounded-md hover:bg-sky-600 disabled:bg-gray-400 flex items-center gap-2">{loadingStates.bluesky && <Loader2 className="w-4 h-4 animate-spin" />} Load More (Bluesky)</button>}
              {cursors.mastodon && <button onClick={() => loadMore('mastodon')} disabled={loadingStates.mastodon || isLoadingAll} className="px-5 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2">{loadingStates.mastodon && <Loader2 className="w-4 h-4 animate-spin" />} Load More (Mastodon)</button>}
              <button onClick={handleLoadAll} disabled={isLoadingAll || (!cursors.bluesky && !cursors.mastodon)} className="px-5 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">{isLoadingAll && <Loader2 className="w-4 h-4 animate-spin" />} {isLoadingAll ? 'Loading All...' : 'Load All Posts'}</button>
            </div>
          )}
        </>
      )}
      {error && <p className="text-center text-red-500 mt-4">{error}</p>}
    </div>
  );
}