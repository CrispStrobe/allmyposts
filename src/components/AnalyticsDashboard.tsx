// src/components/AnalyticsDashboard.tsx
'use client';
import { useMemo } from 'react';
import { UnifiedPost } from '@/lib/types'; // FIXED: Import from the central types file
import Post from './Post';
import { BarChart3, Heart, Repeat, MessageCircle, Clock, TrendingUp, Star } from 'lucide-react';

interface AnalyticsDashboardProps {
  posts: UnifiedPost[];
}

// A small component for displaying individual stats
const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
        <Icon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <div className="text-2xl font-bold text-blue-600">{value}</div>
        <div className="text-sm text-gray-600">{title}</div>
    </div>
);

export default function AnalyticsDashboard({ posts }: AnalyticsDashboardProps) {
    const analytics = useMemo(() => {
        // First, filter out mere reposts before any calculations
        const originalPosts = posts.filter(post => !post.isRepost);

        if (!originalPosts.length) return null;

        // All subsequent calculations now use the filtered 'originalPosts' array
        const totalLikes = originalPosts.reduce((sum, post) => sum + (post.likeCount ?? 0), 0);
        const totalReposts = originalPosts.reduce((sum, post) => sum + (post.repostCount ?? 0), 0);
        
        const topPostByLikes = [...originalPosts].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];

        const postsByHour: number[] = Array(24).fill(0);
        originalPosts.forEach(post => {
            const hour = new Date(post.createdAt).getHours();
            postsByHour[hour]++;
        });

        return {
            totalPosts: originalPosts.length,
            totalLikes,
            totalReposts,
            avgLikes: (totalLikes / originalPosts.length).toFixed(1),
            avgReposts: (totalReposts / originalPosts.length).toFixed(1),
            topPostByLikes,
            postsByHour,
        };
    }, [posts]);

    if (!analytics) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">Not Enough Data</h3>
              <p className="text-gray-500">Load more posts to generate analytics.</p>
            </div>
        );
    }
    
    const maxHourlyPosts = Math.max(...analytics.postsByHour, 1);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-8">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analytics Dashboard (Original Posts & Quotes)
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard title="Original Posts" value={analytics.totalPosts} icon={MessageCircle} />
                <StatCard title="Total Likes" value={analytics.totalLikes.toLocaleString()} icon={Heart} />
                <StatCard title="Total 'Boosts'" value={analytics.totalReposts.toLocaleString()} icon={Repeat} />
                <StatCard title="Avg. Likes" value={analytics.avgLikes} icon={TrendingUp} />
                <StatCard title="Avg. Boosts" value={analytics.avgReposts} icon={TrendingUp} />
            </div>

            <div>
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Clock className="w-5 h-5"/>Posting Activity by Hour (Local Time)</h3>
                <div className="flex items-end justify-between gap-1 h-32 bg-gray-50 p-4 rounded-lg">
                    {analytics.postsByHour.map((count, hour) => (
                        <div key={hour} className="flex-1 flex flex-col items-center justify-end group">
                            <div 
                                className="w-full bg-blue-200 hover:bg-blue-400 transition-all" 
                                style={{ height: `${(count / maxHourlyPosts) * 100}%`, minHeight: '1px' }}
                                title={`${count} posts at ${hour}:00`}
                            ></div>
                            <span className="text-xs text-gray-400 mt-1">{hour % 6 === 0 ? hour : ''}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                 <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Star className="w-5 h-5"/>Top Post by Likes</h3>
                 <Post post={analytics.topPostByLikes} />
            </div>
        </div>
    );
}