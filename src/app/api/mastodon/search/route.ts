// src/app/api/mastodon/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { mastodonInstances } from '@/lib/mastodon-instances';

interface MastodonAccountSuggestion {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
}

// This function queries a single instance to see if a user exists.
async function queryInstance(instance: string, username: string): Promise<MastodonAccountSuggestion | null> {
    try {
        const url = `https://${instance}/api/v1/accounts/lookup?acct=${username}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        // Return a standardized profile object
        return {
            id: data.id,
            handle: `@${data.acct}@${instance}`,
            displayName: data.display_name,
            avatar: data.avatar,
        };
    } catch (error) {
        console.error("Mastodon queryInstance error:", error);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { username, partialInstance } = await req.json();

        if (!username || !partialInstance) {
            return NextResponse.json({ error: 'Username and partial instance are required' }, { status: 400 });
        }

        // Find all matching instances from our predefined list
        const matchingInstances = mastodonInstances.filter(instance => 
            instance.startsWith(partialInstance.toLowerCase())
        );

        // Create a lookup promise for each matching instance
        const lookupPromises = matchingInstances.map(instance => queryInstance(instance, username));

        // Execute all lookups in parallel and wait for them to complete
        const results = await Promise.allSettled(lookupPromises);

        // Filter out failed lookups and collect the successful ones
        const foundAccounts = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => (result as PromiseFulfilledResult<MastodonAccountSuggestion>).value);

        return NextResponse.json({ accounts: foundAccounts });

    } catch (error) {
        console.error("Mastodon search error:", error);
        return NextResponse.json({ error: 'Failed to search for Mastodon accounts.' }, { status: 500 });
    }
}