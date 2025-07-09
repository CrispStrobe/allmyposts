// src/components/PostThread.tsx
'use client';
import { UnifiedPost } from '@/lib/types'; // Import from the central types file
import Post from './Post';

export interface ThreadView {
  post: UnifiedPost;
  replies?: ThreadView[];
}

interface ThreadProps {
  post: UnifiedPost;
  allPosts: UnifiedPost[];
  hideMedia: boolean;
}

export default function PostThread({ post, allPosts, hideMedia }: ThreadProps) {
  // Find all posts in the list that are a direct reply to the current post
  const replies = allPosts.filter(p => p.replyParentUri === post.uri);

  return (
    <div className="flex flex-col">
      <Post post={post} hideMedia={hideMedia} />
      
      {replies.length > 0 && (
        <div className="pl-5 border-l-2 border-gray-200 ml-5 space-y-2 pt-2">
          {replies.map(replyPost => (
            <PostThread 
              key={replyPost.uri} 
              post={replyPost} 
              allPosts={allPosts} 
              hideMedia={hideMedia} 
            />
          ))}
        </div>
      )}
    </div>
  );
}