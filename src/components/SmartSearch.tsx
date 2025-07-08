// src/components/SmartSearch.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type AppBskyActorDefs } from '@atproto/api';
import { Loader2, Search } from 'lucide-react';
import Image from 'next/image';

export default function SmartSearch() {
  const [bskyQuery, setBskyQuery] = useState('');
  const [mastodonQuery, setMastodonQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [includeReplies, setIncludeReplies] = useState(true);
  const [hideReposts, setHideReposts] = useState(false);
  const [startWithMediaHidden, setStartWithMediaHidden] = useState(false);

  const debounce = useCallback((func: (term: string) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (term: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { func(term); }, delay);
    };
  }, []);

  const searchForActors = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      return;
    };
    setIsLoading(true);
    try {
      const response = await fetch('/api/search-actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, platform: 'bluesky' }),
      });
      const data = await response.json();
      if (data.actors) setSuggestions(data.actors);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIXED: Replaced `useCallback` with `useMemo` for creating the debounced function.
  // This is a more idiomatic way to handle this and satisfies the linter.
  const debouncedSearch = useMemo(
    () => debounce(searchForActors, 300),
    [debounce, searchForActors]
  );
  
  useEffect(() => {
    debouncedSearch(bskyQuery);
  }, [bskyQuery, debouncedSearch]);

  const handleSuggestionClick = (handle: string) => {
    setBskyQuery(handle);
    setSuggestions([]);
  };
  
  const handleFetchClick = () => {
    if (!bskyQuery && !mastodonQuery) {
        alert("Please enter at least one handle to fetch.");
        return;
    };
    const params = new URLSearchParams();
    if (bskyQuery) params.set('bsky', bskyQuery);
    if (mastodonQuery) params.set('mastodon', mastodonQuery);
    params.set('replies', String(includeReplies));
    params.set('hideReposts', String(hideReposts));
    params.set('hideMedia', String(startWithMediaHidden));
    router.push(`/posts?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
        <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="relative">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Bluesky Handle</label>
                 <div className="absolute inset-y-0 left-0 pl-3 pt-7 flex items-center pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
                 <input type="text" value={bskyQuery} onChange={(e) => setBskyQuery(e.target.value)} placeholder="e.g., did.bsky.social" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"/>
                 {isLoading && <Loader2 className="absolute right-3 top-1/2 pt-3 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
                 {suggestions.length > 0 && bskyQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    {suggestions.map(actor => (
                        <button key={actor.did} onClick={() => handleSuggestionClick(actor.handle)} className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3">
                          <Image src={actor.avatar ?? '/default-avatar.png'} alt={actor.displayName ?? ''} width={40} height={40} className="rounded-full" />
                          <div>
                              <p className="font-semibold text-gray-800">{actor.displayName || actor.handle}</p>
                              <p className="text-sm text-gray-500">@{actor.handle}</p>
                          </div>
                        </button>
                    ))}
                    </div>
                 )}
            </div>
            
             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Mastodon Handle</label>
                 <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
                     <input type="text" value={mastodonQuery} onChange={(e) => setMastodonQuery(e.target.value)} placeholder="e.g., @user@instance.tld" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"/>
                 </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Options</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-700">
                    <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={includeReplies} onChange={(e) => setIncludeReplies(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Include Replies</label>
                    <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={hideReposts} onChange={(e) => setHideReposts(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Hide Reposts</label>
                    <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={startWithMediaHidden} onChange={(e) => setStartWithMediaHidden(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Hide Media</label>
                </div>
            </div>
        </div>

        <div className="mt-6">
            <button onClick={handleFetchClick} className="w-full px-6 py-4 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400" disabled={!bskyQuery && !mastodonQuery}>Fetch Posts</button>
        </div>
    </div>
  );
}