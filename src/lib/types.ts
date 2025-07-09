// src/lib/types.ts
import { type mastodon } from 'masto';
import { type AppBskyFeedDefs } from '@atproto/api';

// export type BlueskyEmbeds = AppBskyEmbedImages.View | AppBskyEmbedRecord.View | AppBskyEmbedExternal.View | { [k: string]: unknown; $type: string; } | null | undefined;
export type MastodonEmbeds = mastodon.v1.MediaAttachment[] | null | undefined;

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

export interface BlueskyUnifiedPost extends UnifiedPostBase {
  platform: 'bluesky';
  embeds?: AppBskyFeedDefs.PostView['embed']; // Use the type directly from the library
  raw: AppBskyFeedDefs.FeedViewPost;
}

export interface MastodonUnifiedPost extends UnifiedPostBase {
  platform: 'mastodon';
  embeds?: MastodonEmbeds;
  raw: mastodon.v1.Status;
}

export type UnifiedPost = BlueskyUnifiedPost | MastodonUnifiedPost;

export interface CrosspostGroup {
    type: 'crosspost';
    id: string;
    posts: UnifiedPost[];
    similarity: number;
}

export type FeedItem = UnifiedPost | CrosspostGroup;

export interface Filters {
    searchTerm: string;
    sortBy: 'newest' | 'oldest' | 'likes' | 'reposts' | 'engagement';
    hasMedia: boolean;
    hideReplies: boolean;
    hideReposts: boolean;
    minLikes: number;
}

export interface MastodonProfile {
    displayName: string;
    handle: string;
    avatar?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    description?: string;
}

// Mastodon link preview cards
export type MastodonPreviewCard = mastodon.v1.PreviewCard;