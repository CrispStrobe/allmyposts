// src/components/Post.tsx
'use client';

import Image from 'next/image';
import { Heart, Repeat, MessageCircle } from 'lucide-react';
import { UnifiedPost } from '@/lib/types'; // FIXED: Import from central types file
import QuotePostView from './QuotePostView';
import MastodonCardView from './MastodonCardView';
// import { type mastodon } from 'masto';
import { AppBskyEmbedImages, AppBskyEmbedRecord, AppBskyEmbedExternal } from '@atproto/api';
// , type AppBskyEmbedDefs 

const Stat = ({ icon: Icon, count }: { icon: React.ElementType, count: number }) => (
    <div className="flex items-center gap-1.5 text-gray-500">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{count > 0 ? count.toLocaleString() : 0}</span>
    </div>
);

const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) { return '—'; }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function Post({ post, hideMedia = false }: { post: UnifiedPost; hideMedia?: boolean; }) {
  
  // Using type guards to safely access platform-specific properties
  const getProfileUrl = (p: UnifiedPost): string => {
    if (p.platform === 'mastodon') {
      const account = p.raw.reblog ? p.raw.reblog.account : p.raw.account;
      return account.url;
    }
    return `https://bsky.app/profile/${p.author.handle}`;
  };

  const getPostUrl = (p: UnifiedPost): string => {
    if (p.platform === 'mastodon') {
      return (p.raw.reblog ? p.raw.reblog.url : p.uri) || p.uri;
    }
    const rkey = p.uri.split('/').pop();
    return `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;
  };

  const mastodonContent = post.platform === 'mastodon' 
    ? (post.raw.reblog ? post.raw.reblog.content : post.raw.content) ?? ''
    : '';

  const getMastodonMediaAttachments = () => {
    if (post.platform !== 'mastodon') return [];
    const possibleSources = [ post.embeds, post.raw.mediaAttachments, post.raw.reblog?.mediaAttachments ];
    for (const source of possibleSources) {
      if (Array.isArray(source) && source.length > 0) {
        return source.filter(item => item && item.type === 'image');
      }
    }
    return [];
  };

  const mastodonMedia = getMastodonMediaAttachments();

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {post.isRepost && post.repostAuthor && (
        <div className="text-sm text-gray-500 flex items-center gap-2 mb-2">
            <Repeat className="w-4 h-4" /> Reposted by {post.repostAuthor.displayName || post.repostAuthor.handle}
        </div>
      )}

      <div className="flex items-start gap-3">
        <a href={getProfileUrl(post)} target="_blank" rel="noopener noreferrer">
            <Image src={post.author.avatar ?? '/default-avatar.png'} alt={post.author.displayName ?? post.author.handle} width={48} height={48} className="w-12 h-12 rounded-full bg-gray-100" />
        </a>
        <div className="flex-1 min-w-0">
            <a href={getProfileUrl(post)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-1 group">
                <span className="font-semibold text-gray-800 group-hover:underline truncate">{post.author.displayName}</span>
                <span className="text-gray-500 group-hover:underline truncate">{post.author.handle}</span>
                {post.platform === 'bluesky' ? <Image src="/bluesky-logo.svg" alt="Bluesky" width={14} height={14} title="Posted on Bluesky" /> : <Image src="/mastodon-logo.svg" alt="Mastodon" width={14} height={14} title="Posted on Mastodon" />}
            </a>
            <div className="min-w-0">
                {post.platform === 'mastodon' ? <div className="prose prose-sm max-w-none text-gray-800 break-words" dangerouslySetInnerHTML={{ __html: mastodonContent }} /> : <p className="text-gray-800 whitespace-pre-wrap break-words">{post.text}</p>}
            </div>
        </div>
      </div>

      {!hideMedia && (
        <div className="mt-2 pl-16">
          
          {post.platform === 'bluesky' && post.embeds && (
            <>
              {AppBskyEmbedImages.isView(post.embeds) && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {post.embeds.images.map((image: AppBskyEmbedImages.ViewImage) => (
                    <a key={image.fullsize} href={image.fullsize} target="_blank" rel="noopener noreferrer">
                      <div className="relative aspect-video"><Image src={image.thumb} alt={image.alt} fill className="rounded-md object-cover"/></div>
                    </a>
                  ))}
                </div>
              )}
              {AppBskyEmbedRecord.isView(post.embeds) && (
                <div className="pt-2">
                  {AppBskyEmbedRecord.isViewRecord(post.embeds.record) && <QuotePostView record={post.embeds.record} />}
                  {AppBskyEmbedRecord.isViewNotFound(post.embeds.record) && <p className="text-sm text-gray-500 border rounded-lg p-3">Quoted post not found.</p>}
                  {AppBskyEmbedRecord.isViewBlocked(post.embeds.record) && <p className="text-sm text-gray-500 border rounded-lg p-3">Post from a blocked account.</p>}
                </div>
              )}
               {AppBskyEmbedExternal.isView(post.embeds) && (
                 <a href={post.embeds.external.uri} target="_blank" rel="noopener noreferrer" className="mt-2 block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                  {post.embeds.external.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.embeds.external.thumb} alt={post.embeds.external.title} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-xs text-gray-500">{new URL(post.embeds.external.uri).hostname}</p>
                    <p className="font-semibold text-gray-800">{post.embeds.external.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{post.embeds.external.description}</p>
                  </div>
                </a>
              )}
            </>
          )}
          
          {post.platform === 'mastodon' && mastodonMedia.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {mastodonMedia.map((attachment, index) => {
                const imageUrl = attachment.previewUrl || attachment.url || attachment.remoteUrl;
                const fullSizeUrl = attachment.url || attachment.remoteUrl || attachment.previewUrl;
                if (!imageUrl) return null;
                return (
                  <a key={attachment.id || index} href={fullSizeUrl || imageUrl} target="_blank" rel="noopener noreferrer">
                    <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={attachment.description || `Mastodon image ${index + 1}`} className="w-full h-full object-cover" loading="lazy" onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const currentSrc = target.src;
                          if (currentSrc === attachment.previewUrl && attachment.url) { target.src = attachment.url;
                          } else if (currentSrc === attachment.url && attachment.remoteUrl) { target.src = attachment.remoteUrl;
                          } else {
                            const parent = target.parentElement;
                            if (parent) parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Image unavailable</div>';
                          }
                        }}
                      />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
          
          {post.platform === 'mastodon' && post.raw.card && <MastodonCardView card={post.raw.card} />}
        </div>
      )}
      
      <div className="flex items-center justify-between mt-4 pl-16">
        <div className="flex items-center gap-5">
            <Stat icon={MessageCircle} count={post.replyCount ?? 0} />
            <Stat icon={Repeat} count={post.repostCount ?? 0} />
            <Stat icon={Heart} count={post.likeCount ?? 0} />
        </div>
        <a href={getPostUrl(post)} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
          {formatDate(post.createdAt)}
        </a>
      </div>
    </div>
  );
}