// src/components/ExportManager.tsx
'use client';

import { useState } from 'react';
import { UnifiedPost } from './PostManager';
import { exportAsJson, exportAsCsv } from '@/lib/export';
import { Download } from 'lucide-react';

interface ExportManagerProps {
  // Receives the array of posts currently visible in the feed
  posts: UnifiedPost[];
  // Used for the filename
  handle: string;
}

export default function ExportManager({ posts, handle }: ExportManagerProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');

  const handleExport = () => {
    // The component simply exports the data it receives as a prop.
    // The distinction between "filtered" and "all" is handled by the user's actions
    // in the main PostManager UI (loading more posts, etc.).
    if (format === 'json') {
      exportAsJson(posts, handle);
    } else if (format === 'csv') {
      exportAsCsv(posts, handle);
    }
    setShowOptions(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
      >
        <Download className="w-4 h-4" />
        Export View
      </button>

      {showOptions && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20">
            <h4 className="font-semibold text-gray-800 mb-3">Export Options</h4>
            <div className="space-y-3">
                <div>
                    <label htmlFor="format-select" className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                        id="format-select"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                        <option value="json">JSON (Full Data)</option>
                        <option value="csv">CSV (Spreadsheet)</option>
                    </select>
                </div>
                 <p className="text-xs text-gray-500">
                    This will export the <strong>{posts.length}</strong> currently visible posts.
                </p>
                <button
                    onClick={handleExport}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                    Generate Export
                </button>
            </div>
        </div>
      )}
    </div>
  );
}