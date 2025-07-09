// src/components/PostManager.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { type mastodon } from 'masto';
import { type AppBskyFeedDefs, AppBskyEmbedImages } from '@atproto/api';
import jaroWinkler from 'jaro-winkler';
import AdvancedFilters from './AdvancedFilters';
import AnalyticsDashboard from './AnalyticsDashboard';
import ExportManager from './ExportManager';
import PostThread from './PostThread';
import Post from './Post';
import { Loader2, Inbox } from 'lucide-react';
import { UnifiedPost, FeedItem, Filters } from '@/lib/types';
import { normalizePost } from '@/lib/utils';

type PlatformPost = AppBskyFeedDefs.FeedViewPost | mastodon.v1.Status;

interface FeedApiResponse {
  feed: PlatformPost[];
  cursor?: string;
  error?: string;
}

interface PlatformData {
    profile: { handle: string };
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
  feedTypes: {
      bluesky: 'posts' | 'likes';
      mastodon: 'posts' | 'likes' | 'bookmarks';
  };
}

export default function PostManager({ 
    initialData, 
    initialHideMedia, 
    initialHideReposts, 
    initialIncludeReplies,
    feedTypes
}: PostManagerProps) {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [cursors, setCursors] = useState({ bluesky: initialData.bluesky?.cursor, mastodon: initialData.mastodon?.cursor });
  const [loadingStates, setLoadingStates] = useState({ moreBsky: false, moreMasto: false, all: false });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [hideMedia, setHideMedia] = useState(initialHideMedia);
  const [viewMode, setViewMode] = useState<'feed' | 'analytics'>('feed');

  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    sortBy: 'newest',
    hasMedia: false,
    minLikes: 0,
    hideReplies: !initialIncludeReplies,
    hideReposts: initialHideReposts,
  });

  useEffect(() => {
    const bskyPosts = initialData.bluesky?.feed.map(p => normalizePost(p, 'bluesky')) ?? [];
    const mastodonPosts = initialData.mastodon?.feed.map(p => normalizePost(p, 'mastodon')) ?? [];
    const combined = [...bskyPosts, ...mastodonPosts].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPosts(combined);
    setProgress(combined.length);
  }, [initialData]);

  const handleFilterChange = (newFilters: Partial<Filters>) => setFilters(prev => ({ ...prev, ...newFilters }));

  const fetchPage = useCallback(async (platform: 'bluesky' | 'mastodon', cursor?: string) => {
    const handle = initialData[platform]?.profile.handle;
    if (!handle) throw new Error("Handle is missing");
    
    const payload = { handle, platform, cursor, feedType: feedTypes[platform], ...filters };
    const response = await fetch('/api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data: FeedApiResponse = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  }, [initialData, filters, feedTypes]);

  const loadMore = useCallback(async (platform: 'bluesky' | 'mastodon') => {
    const cursor = cursors[platform];
    if (!cursor) return;

    setLoadingStates(prev => ({ ...prev, [platform === 'bluesky' ? 'moreBsky' : 'moreMasto']: true }));
    try {
        const data = await fetchPage(platform, cursor);
        const newPosts = data.feed.map(p => normalizePost(p, platform));
        setPosts(prev => [...prev, ...newPosts].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setCursors(prev => ({ ...prev, [platform]: data.cursor }));
        setProgress(prev => prev + newPosts.length);
    } catch (e) {
        setError(`Failed to load more from ${platform}: ${(e as Error).message}`);
    } finally {
        setLoadingStates(prev => ({ ...prev, [platform === 'bluesky' ? 'moreBsky' : 'moreMasto']: false }));
    }
  }, [cursors, fetchPage]);

  const handleLoadAll = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, all: true }));
    const loadAllForPlatform = async (platform: 'bluesky' | 'mastodon') => {
        let currentCursor = cursors[platform];
        while (currentCursor) {
            try {
                const data = await fetchPage(platform, currentCursor);
                const newPosts = data.feed.map(p => normalizePost(p, platform));
                setPosts(prev => [...prev, ...newPosts].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                currentCursor = data.cursor;
                setCursors(prev => ({ ...prev, [platform]: currentCursor }));
                setProgress(prev => prev + newPosts.length);
            } catch (err) {
                setError(`Failed during 'Load All' for ${platform}: ${(err as Error).message}`);
                currentCursor = undefined;
            }
        }
    };
    await Promise.all([loadAllForPlatform('bluesky'), loadAllForPlatform('mastodon')]);
    setLoadingStates(prev => ({ ...prev, all: false }));
  }, [cursors, fetchPage]);

  const finalFeed = useMemo((): FeedItem[] => {
      const filteredPosts = posts.filter(post => {
          if (filters.hideReposts && post.isRepost) return false;
          if (filters.searchTerm && !post.text.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
          
          if (filters.hideReplies) {
              const isFormalReply = !!post.replyParentUri;
              const isMention = post.platform === 'mastodon' && post.text.trim().startsWith('@');
              if (isFormalReply || isMention) return false;
          }

          if (filters.hasMedia) {
              const hasBskyImages = post.platform === 'bluesky' && AppBskyEmbedImages.isView(post.embeds);
              const hasMastoImages = post.platform === 'mastodon' && ((Array.isArray(post.embeds) && post.embeds.some(att => att.type === 'image')) || !!post.raw.card?.image);
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

      const postsForThreading = feedItems.flatMap(item => 'posts' in item ? [] : [item]);
      const postsByUri = new Map(postsForThreading.map(p => [p.uri, p]));
      const threadRoots = postsForThreading.filter(p => !p.replyParentUri || !postsByUri.has(p.replyParentUri));
      return feedItems.filter(item => 'posts' in item || threadRoots.some(root => 'uri' in item && root.uri === item.uri));
  }, [posts, filters]);
  
  const feedForExport = useMemo((): UnifiedPost[] => finalFeed.flatMap(item => 'posts' in item ? item.posts : item), [finalFeed]);
  const hasMoreContent = cursors.bluesky || cursors.mastodon;
  const isLoading = loadingStates.all || loadingStates.moreBsky || loadingStates.moreMasto;

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
          
          {isLoading && posts.length === 0 && (
             <div className="text-center py-12"><Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto"/></div>
          )}

          {!isLoading && finalFeed.length === 0 && (
             <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">{posts.length > 0 ? 'No Posts Match Your Filters' : 'No Posts Found'}</h3>
                <p className="text-gray-500">{posts.length > 0 ? 'Try adjusting the filter settings.' : 'The initial fetch returned no content for this user.'}</p>
            </div>
          )}

          {finalFeed.length > 0 && (
            <div className="space-y-6">
              {finalFeed.map(item => {
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
          )}
          
          {hasMoreContent && (
            <div className="text-center mt-8 flex flex-wrap items-center justify-center gap-4">
              {cursors.bluesky && <button onClick={() => loadMore('bluesky')} disabled={loadingStates.moreBsky || loadingStates.all} className="px-5 py-2 font-semibold text-white bg-sky-500 rounded-md hover:bg-sky-600 disabled:bg-gray-400 flex items-center gap-2">{loadingStates.moreBsky && <Loader2 className="w-4 h-4 animate-spin" />} Load More (Bluesky)</button>}
              {cursors.mastodon && <button onClick={() => loadMore('mastodon')} disabled={loadingStates.moreMasto || loadingStates.all} className="px-5 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2">{loadingStates.moreMasto && <Loader2 className="w-4 h-4 animate-spin" />} Load More (Mastodon)</button>}
              <button onClick={handleLoadAll} disabled={loadingStates.all || !hasMoreContent} className="px-5 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">{loadingStates.all && <Loader2 className="w-4 h-4 animate-spin" />} {loadingStates.all ? `Loading... (${progress})` : 'Load All Posts'}</button>
            </div>
          )}
        </>
      )}
      {error && <p className="text-center text-red-500 mt-4">{error}</p>}
    </div>
  );
}