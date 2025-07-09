// src/components/SmartSearch.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type AppBskyActorDefs } from '@atproto/api';
import { Loader2, Search } from 'lucide-react';
import Image from 'next/image';

interface SmartSearchProps {
  isMastodonConnected: boolean;
  initialMastodonHandle?: string;
}

interface MastodonSuggestion {
    id: string;
    handle: string;
    displayName: string;
    avatar: string;
}

export default function SmartSearch({ isMastodonConnected, initialMastodonHandle }: SmartSearchProps) {
  const [bskyQuery, setBskyQuery] = useState('');
  const [mastodonQuery, setMastodonQuery] = useState(initialMastodonHandle || '');
  const [bskySuggestions, setBskySuggestions] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [mastoSuggestions, setMastoSuggestions] = useState<MastodonSuggestion[]>([]);
  const [bskyLoading, setBskyLoading] = useState(false);
  const [mastoLoading, setMastoLoading] = useState(false);
  const router = useRouter();

  // FIXED: Correctly type the state for the primary mode
  const [primaryMode, setPrimaryMode] = useState<'posts' | 'saved'>('posts');
  const [mastodonSavedType, setMastodonSavedType] = useState<'likes' | 'bookmarks'>('likes');
  
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
    if (term.length < 2) { setBskySuggestions([]); return; };
    setBskyLoading(true);
    try {
      const res = await fetch('/api/search-actors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term, platform: 'bluesky' }) });
      const data = await res.json();
      if (data.actors) setBskySuggestions(data.actors);
    } catch (error) { console.error('Bluesky search failed', error); } 
    finally { setBskyLoading(false); }
  }, []);

  const searchMastodon = useCallback(async (term: string) => {
    const match = term.match(/^@?([^@]+)@(.+)/);
    if (!match || !match[1] || !match[2]) { setMastoSuggestions([]); return; }
    const [, username, partialInstance] = match;
    setMastoLoading(true);
    try {
        const res = await fetch('/api/mastodon/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, partialInstance }) });
        const data = await res.json();
        if (data.accounts) setMastoSuggestions(data.accounts);
    } catch (error) { console.error('Mastodon search failed', error); }
    finally { setMastoLoading(false); }
  }, []);

  const debouncedBskySearch = useMemo(() => debounce(searchForActors, 300), [debounce, searchForActors]);
  const debouncedMastoSearch = useMemo(() => debounce(searchMastodon, 500), [debounce, searchMastodon]);
  
  useEffect(() => { debouncedBskySearch(bskyQuery); }, [bskyQuery, debouncedBskySearch]);
  useEffect(() => { debouncedMastoSearch(mastodonQuery); }, [mastodonQuery, debouncedMastoSearch]);

  const handleSuggestionClick = (setter: (value: string) => void, handle: string, suggestionSetter: (items: never[]) => void) => {
    setter(handle);
    suggestionSetter([]);
  };
  
  const handleFetchClick = () => {
    const params = new URLSearchParams();

    if (primaryMode === 'saved') {
        if(bskyQuery) params.set('bsky_feed', 'likes');
        if (isMastodonConnected && mastodonQuery) params.set('mastodon_feed', mastodonSavedType);
    } else {
        if(bskyQuery) params.set('bsky_feed', 'posts');
        if(mastodonQuery) params.set('mastodon_feed', 'posts');
    }
    
    if (bskyQuery) params.set('bsky', bskyQuery);
    if (mastodonQuery) params.set('mastodon', mastodonQuery);

    if (!params.get('bsky') && !params.get('mastodon')) {
        alert("Please provide at least one handle.");
        return;
    }

    params.set('replies', String(includeReplies));
    params.set('hideReposts', String(hideReposts));
    params.set('hideMedia', String(startWithMediaHidden));
    router.push(`/posts?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 flex justify-center p-1 bg-gray-200 rounded-lg">
          <button onClick={() => setPrimaryMode('posts')} className={`px-4 py-2 text-sm w-1/2 font-semibold rounded-md transition-colors ${primaryMode === 'posts' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'}`}>My Posts</button>
          <button onClick={() => setPrimaryMode('saved')} className={`px-4 py-2 text-sm w-1/2 font-semibold rounded-md transition-colors ${primaryMode === 'saved' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'}`}>My Saved Content</button>
      </div>

      {primaryMode === 'saved' && (
        <div className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-lg text-sm">
            <div className="font-semibold text-gray-700">Bluesky: <span className="font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded-md">Show Likes</span></div>
            <div className="mt-2 font-semibold text-gray-700">Mastodon:
                {isMastodonConnected ? (
                    <div className="inline-flex p-1 bg-gray-300 rounded-md ml-2">
                        <button onClick={() => setMastodonSavedType('likes')} className={`px-2 py-1 text-xs rounded ${mastodonSavedType === 'likes' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-700'}`}>Likes</button>
                        <button onClick={() => setMastodonSavedType('bookmarks')} className={`px-2 py-1 text-xs rounded ${mastodonSavedType === 'bookmarks' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-700'}`}>Bookmarks</button>
                    </div>
                ) : <span className="font-normal text-gray-500 ml-2">Connect account to enable</span>}
            </div>
        </div>
      )}

      <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        {/* Bluesky Input Section */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bluesky Handle</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
            <input type="text" value={bskyQuery} onChange={(e) => setBskyQuery(e.target.value)} placeholder="e.g., did.bsky.social" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"/>
            {bskyLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
          </div>
          {bskySuggestions.length > 0 && bskyQuery && (
            <div className="absolute w-full top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {bskySuggestions.map(actor => (
                <button key={actor.did} onClick={() => handleSuggestionClick(setBskyQuery, actor.handle, setBskySuggestions)} className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3">
                  <Image src={actor.avatar ?? '/default-avatar.png'} alt={actor.displayName ?? ''} width={40} height={40} className="rounded-full" />
                  <div><p className="font-semibold text-gray-800">{actor.displayName || actor.handle}</p><p className="text-sm text-gray-500">@{actor.handle}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Mastodon Input Section */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Mastodon Handle</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
            <input type="text" value={mastodonQuery} onChange={(e) => setMastodonQuery(e.target.value)} placeholder="@user@instance.com" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"/>
            {mastoLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
          </div>
          {mastoSuggestions.length > 0 && mastodonQuery && (
            <div className="absolute w-full top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
              {mastoSuggestions.map(account => (
                <button key={account.id} onClick={() => handleSuggestionClick(setMastodonQuery, account.handle, setMastoSuggestions)} className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3">
                  <Image src={account.avatar} alt={account.displayName} width={40} height={40} className="rounded-full" />
                  <div><p className="font-semibold text-gray-800">{account.displayName}</p><p className="text-sm text-gray-500">{account.handle}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {primaryMode === 'posts' && (
          <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Options</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-700">
                <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={includeReplies} onChange={(e) => setIncludeReplies(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Include Replies</label>
                <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={hideReposts} onChange={(e) => setHideReposts(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Hide Reposts</label>
                <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={startWithMediaHidden} onChange={(e) => setStartWithMediaHidden(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Hide Media</label>
              </div>
          </div>
        )}
      </div>

      <div className="mt-6">
          <button onClick={handleFetchClick} className="w-full px-6 py-4 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">Fetch</button>
      </div>
    </div>
  );
}