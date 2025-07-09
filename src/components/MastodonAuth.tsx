// src/components/MastodonAuth.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MastodonAuthProps {
  // Pass the login status from a Server Component parent
  isConnected: boolean;
  userHandle?: string;
}

export default function MastodonAuth({ isConnected, userHandle }: MastodonAuthProps) {
  const [instanceUrl, setInstanceUrl] = useState('mastodon.social');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');

    // FIX: Sanitize the input to only get the instance hostname
    let cleanInstanceUrl = instanceUrl.trim();
    if (cleanInstanceUrl.includes('@')) {
        cleanInstanceUrl = cleanInstanceUrl.split('@').pop() || '';
    }
    // End of fix

    if (!cleanInstanceUrl.includes('.')) {
        setError('Please enter a valid instance URL (e.g., mastodon.social)');
        setIsLoading(false);
        return;
    }

    try {
        const response = await fetch('/api/auth/mastodon/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the cleaned URL
        body: JSON.stringify({ instanceUrl: cleanInstanceUrl }),
        });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL from server.');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;

    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
      router.push('/api/auth/mastodon/logout');
  };

  if (isConnected) {
    return (
        <div className="mt-8 p-4 border-t border-gray-200">
            <div className="text-center max-w-md mx-auto">
                <p className="text-sm text-gray-600">
                    Connected as <span className="font-semibold text-purple-700">{userHandle}</span>
                </p>
                <button
                    onClick={handleDisconnect}
                    className="mt-2 text-xs text-gray-500 hover:underline"
                >
                    Disconnect
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="mt-8 p-4 border-t border-gray-200">
      <h3 className="font-semibold text-gray-700 text-center">View Your Mastodon Likes</h3>
      <p className="text-center text-sm text-gray-500 mt-1">
        Connect your Mastodon account to view your private feed of favorited posts.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
        <input
          type="text"
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          placeholder="your.instance.com"
          className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isLoading}
        />
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect with Mastodon'}
        </button>
      </div>
      {error && <p className="text-center text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}