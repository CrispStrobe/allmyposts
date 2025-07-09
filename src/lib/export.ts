// src/lib/export.ts
import { UnifiedPost } from '@/lib/types';
import { type mastodon } from 'masto';
import { AppBskyEmbedImages, AppBskyEmbedRecord, AppBskyEmbedExternal } from '@atproto/api';

function triggerDownload(content: string, mimeType: string, fileName: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportAsJson(posts: UnifiedPost[], handle: string) {
    const dataStr = JSON.stringify({
        user: handle,
        exportDate: new Date().toISOString(),
        postCount: posts.length,
        posts: posts.map(p => p.raw),
    }, null, 2);
    triggerDownload(dataStr, 'application/json', `posts-${handle}-${Date.now()}.json`);
}

export function exportAsCsv(posts: UnifiedPost[], handle: string) {
    const headers = ['uri', 'platform', 'author_handle', 'text', 'likes', 'reposts', 'replies', 'createdAt', 'is_repost', 'repost_author_handle'];
    const escapeCsvField = (field: string | number | undefined): string => {
        if (field === undefined || field === null) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const rows = posts.map(post => [
        post.uri, post.platform, post.author.handle,
        escapeCsvField(post.text), post.likeCount ?? 0, post.repostCount ?? 0,
        post.replyCount ?? 0, post.createdAt, post.isRepost,
        escapeCsvField(post.repostAuthor?.handle)
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    triggerDownload(csvContent, 'text/csv;charset=utf-8;', `posts-${handle}-${Date.now()}.csv`);
}

// --- NEW EXPORT FUNCTIONS ---

// ** URL List Export **
export function exportAsUrlList(posts: UnifiedPost[], handle: string) {
    const urls = new Set<string>();
    posts.forEach(post => {
        // Add the post's own URL
        if (post.platform === 'mastodon') {
            const mastoStatus = post.raw as mastodon.v1.Status;
            urls.add((mastoStatus.reblog ? mastoStatus.reblog.url : post.uri) || post.uri);
        } else {
            const rkey = post.uri.split('/').pop();
            urls.add(`https://bsky.app/profile/${post.author.handle}/post/${rkey}`);
        }

        // Add URLs from embeds
        if (post.platform === 'bluesky' && post.embeds) {
            if (AppBskyEmbedExternal.isView(post.embeds)) urls.add(post.embeds.external.uri);
            if (AppBskyEmbedRecord.isView(post.embeds) && 'uri' in post.embeds.record) urls.add(post.embeds.record.uri);
        } else if (post.platform === 'mastodon') {
            if ((post.raw as mastodon.v1.Status).card) {
                urls.add((post.raw as mastodon.v1.Status).card!.url);
            }
        }
    });
    const urlContent = Array.from(urls).join('\n');
    triggerDownload(urlContent, 'text/plain;charset=utf-8;', `urls-${handle}-${Date.now()}.txt`);
}

// ** Markdown Export **
function formatPostAsMarkdown(post: UnifiedPost): string {
    let md = `### @${post.author.handle} on ${new Date(post.createdAt).toLocaleString()}\n\n`;
    md += `${post.text.replace(/^/gm, '> ')}\n\n`;

    if (post.platform === 'bluesky' && post.embeds) {
        if (AppBskyEmbedImages.isView(post.embeds)) {
            post.embeds.images.forEach(img => {
                md += `![${img.alt}](${img.thumb})\n`;
            });
        }
        if (AppBskyEmbedExternal.isView(post.embeds)) {
            md += `**Link:** [${post.embeds.external.title}](${post.embeds.external.uri})\n`;
        }
    } else if (post.platform === 'mastodon') {
        const rawPost = post.raw as mastodon.v1.Status;
        rawPost.mediaAttachments?.forEach(att => {
            if (att.type === 'image') md += `![${att.description || 'image'}](${att.url})\n`;
        });
        if (rawPost.card) {
            md += `**Link:** [${rawPost.card.title}](${rawPost.card.url})\n`;
        }
    }
    
    const postUrl = post.platform === 'mastodon' ? (post.raw as mastodon.v1.Status).url || post.uri : `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`;
    md += `\n❤️ ${post.likeCount ?? 0} | 🔁 ${post.repostCount ?? 0} | [Original Post](${postUrl})\n\n---\n`;
    return md;
}

export function exportAsMarkdown(posts: UnifiedPost[], handle: string) {
    const title = `# Post Archive for ${handle}\n\nExported on ${new Date().toUTCString()}\n\n---\n\n`;
    const markdownContent = title + posts.map(formatPostAsMarkdown).join('');
    triggerDownload(markdownContent, 'text/markdown;charset=utf-8;', `posts-${handle}-${Date.now()}.md`);
}

// ** HTML Export **
function getHtmlStyles(): string {
    return `
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
            article { border-bottom: 1px solid #ddd; padding-bottom: 1.5rem; margin-bottom: 1.5rem; }
            h1 { color: #111; }
            h3 { margin-bottom: 0.5rem; }
            blockquote { border-left: 3px solid #eee; padding-left: 1rem; margin-left: 0; font-style: italic; }
            img { max-width: 100%; height: auto; border-radius: 8px; margin-top: 1rem; }
            footer { font-size: 0.9rem; color: #666; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    `;
}

function formatPostAsHtml(post: UnifiedPost): string {
    let body = `<h3>@${post.author.handle} on ${new Date(post.createdAt).toLocaleString()}</h3>`;
    body += `<blockquote><p>${post.text.replace(/\n/g, '<br>')}</p></blockquote>`;

    let mediaHtml = '';
    if (post.platform === 'bluesky' && post.embeds) {
        if (AppBskyEmbedImages.isView(post.embeds)) {
            post.embeds.images.forEach(img => { mediaHtml += `<a href="${img.fullsize}"><img src="${img.thumb}" alt="${img.alt}"></a>`; });
        }
        if (AppBskyEmbedExternal.isView(post.embeds)) {
            mediaHtml += `<p><strong>Link:</strong> <a href="${post.embeds.external.uri}">${post.embeds.external.title}</a></p>`;
        }
    } else if (post.platform === 'mastodon') {
        const rawPost = post.raw as mastodon.v1.Status;
        rawPost.mediaAttachments?.forEach(att => {
            if (att.type === 'image') mediaHtml += `<a href="${att.url}"><img src="${att.previewUrl || att.url}" alt="${att.description || 'image'}"></a>`;
        });
        if (rawPost.card) {
            mediaHtml += `<p><strong>Link:</strong> <a href="${rawPost.card.url}">${rawPost.card.title}</a></p>`;
        }
    }
    body += mediaHtml;

    const postUrl = post.platform === 'mastodon' ? (post.raw as mastodon.v1.Status).url || post.uri : `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`;
    body += `<footer>❤️ ${post.likeCount ?? 0} | 🔁 ${post.repostCount ?? 0} | <a href="${postUrl}">Original Post</a></footer>`;

    return `<article>${body}</article>`;
}

export function exportAsHtml(posts: UnifiedPost[], handle: string) {
    const title = `<h1>Post Archive for ${handle}</h1><p>Exported on ${new Date().toUTCString()}</p>`;
    const bodyContent = posts.map(formatPostAsHtml).join('');
    const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Posts for ${handle}</title>${getHtmlStyles()}</head><body>${title}${bodyContent}</body></html>`;
    triggerDownload(htmlContent, 'text/html;charset=utf-8;', `posts-${handle}-${Date.now()}.html`);
}