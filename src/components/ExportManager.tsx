// src/components/ExportManager.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { UnifiedPost } from '@/lib/types'; // Import from the central types file
import { exportAsJson, exportAsCsv, exportAsHtml, exportAsMarkdown, exportAsUrlList } from '@/lib/export';
import { Download } from 'lucide-react';


interface ExportManagerProps {
  posts: UnifiedPost[];
  handle: string;
}

type ExportFormat = 'json' | 'csv' | 'html' | 'md' | 'urls';

export default function ExportManager({ posts, handle }: ExportManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [includeMedia, setIncludeMedia] = useState(false); // For future use in Stage 2
  const modalRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    switch (format) {
      case 'json':
        exportAsJson(posts, handle);
        break;
      case 'csv':
        exportAsCsv(posts, handle);
        break;
      case 'html':
        exportAsHtml(posts, handle);
        break;
      case 'md':
        exportAsMarkdown(posts, handle);
        break;
      case 'urls':
        exportAsUrlList(posts, handle);
        break;
    }
    setIsOpen(false);
  };

  // Close modal if clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalRef]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
      >
        <Download className="w-4 h-4" />
        Export View
      </button>

      {isOpen && (
        <div 
          ref={modalRef}
          className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-20"
        >
          <h4 className="font-semibold text-gray-800 mb-3">Export Options</h4>
          
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700 mb-1">Format</legend>
            
            {(['json', 'csv', 'html', 'md', 'urls'] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                    <input
                        type="radio"
                        name="format"
                        value={fmt}
                        checked={format === fmt}
                        onChange={() => setFormat(fmt)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-800">
                        {
                            {json: 'JSON (Raw Data)', csv: 'CSV (Spreadsheet)', html: 'HTML (Web Page)', md: 'Markdown', urls: 'URL List (.txt)'}[fmt]
                        }
                    </span>
                </label>
            ))}
          </fieldset>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <legend className="text-sm font-medium text-gray-700 mb-1">Options</legend>
            <label className="flex items-center gap-2 p-2 rounded-md text-gray-400 cursor-not-allowed" title="Coming soon!">
                <input
                    type="checkbox"
                    checked={includeMedia}
                    onChange={(e) => setIncludeMedia(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    disabled // Media export will be implemented in Stage 2
                />
                <span className="text-sm">Include media (creates .zip)</span>
            </label>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            This will export the <strong>{posts.length}</strong> currently visible posts.
          </p>
          <button
            onClick={handleExport}
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Generate Export
          </button>
        </div>
      )}
    </div>
  );
}