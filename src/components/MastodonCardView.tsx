// src/components/MastodonCardView.tsx
'use client';

import { type mastodon } from 'masto';

// Use the official PreviewCard type from the masto library for perfect compatibility
type MastodonPreviewCard = mastodon.v1.PreviewCard;

export default function MastodonCardView({ card }: { card: MastodonPreviewCard }) {
    return (
        <a href={card.url} target="_blank" rel="noopener noreferrer" className="mt-2 block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors no-underline">
            {/* If a preview image exists for the card, display it */}
            {card.image && (
                <div className="relative aspect-video bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>
            )}
            <div className="p-3">
                <p className="font-semibold text-gray-800 text-sm truncate">{card.title}</p>
                {/* The description is already HTML, so render it safely */}
                <div className="text-sm text-gray-600 mt-1 line-clamp-3" dangerouslySetInnerHTML={{ __html: card.description }}></div>
                {/* Only render the provider name if it exists */}
                {card.providerName && (
                  <p className="text-xs text-gray-500 mt-2 truncate">{card.providerName}</p>
                )}
            </div>
        </a>
    );
}