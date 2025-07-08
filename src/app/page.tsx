// src/app/page.tsx
import SmartSearch from '@/components/SmartSearch';
import { Github } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-gray-50">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">All My Posts</h1>
        <p className="mt-2 text-lg text-gray-500">View, search, and export feeds from Bluesky and Mastodon.</p>
      </div>

      <SmartSearch />

      <footer className="mt-12 text-center text-gray-500">
      
         <div className="flex justify-center gap-4 mt-2">
           <a href="https://github.com/CrispStrobe/allmyposts" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800"><Github/></a>
        </div>
      </footer>
    </main>
  );
}