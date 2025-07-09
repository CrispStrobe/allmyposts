// src/lib/utils.ts
import { UnifiedPost } from './types';
import { type mastodon } from 'masto';
// Import the value, not just the type, to use its functions
import { AppBskyFeedDefs } from '@atproto/api';

type PlatformPost = AppBskyFeedDefs.FeedViewPost | mastodon.v1.Status;

export const normalizePost = (post: PlatformPost, platform: 'bluesky' | 'mastodon'): UnifiedPost => {
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
    } else {
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