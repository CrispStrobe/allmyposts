// src/lib/export.ts
import { UnifiedPost } from '@/components/PostManager';

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
        posts: posts.map(p => p.raw), // Export the raw, original data for full fidelity
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

    const rows = posts.map(post => {
        return [
            post.uri,
            post.platform,
            post.author.handle,
            escapeCsvField(post.text),
            post.likeCount ?? 0,
            post.repostCount ?? 0,
            post.replyCount ?? 0,
            post.createdAt,
            post.isRepost,
            escapeCsvField(post.repostAuthor?.handle)
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    triggerDownload(csvContent, 'text/csv;charset=utf-8;', `posts-${handle}-${Date.now()}.csv`);
}