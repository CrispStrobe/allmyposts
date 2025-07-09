// src/lib/mastodon-agent.ts
import { type mastodon, createRestAPIClient } from 'masto';
import { getSession } from './session';

export type MastodonPost = mastodon.v1.Status;

export class MastodonAgent {
    private instanceUrl: string;

    constructor(handle: string) {
        // FIXED: Make handle parsing more robust
        const cleanHandle = handle.trim().startsWith('@') ? handle.trim().substring(1) : handle.trim();
        const handleParts = cleanHandle.split('@');
        
        if (handleParts.length !== 2 || !handleParts[0] || !handleParts[1]) {
            throw new Error('Invalid Mastodon handle. Please use the format user@instance.tld');
        }
        this.instanceUrl = `https://${handleParts[1]}`;
    }

    private async fetchPublic<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.instanceUrl}${endpoint}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error(`Account not found at ${this.instanceUrl}. Please check the handle and instance name.`);
            throw new Error(`Mastodon API error (${response.status}): ${response.statusText}`);
        }
        return response.json();
    }

    async getAccountByHandle(handle: string): Promise<mastodon.v1.Account> {
        const fullAcct = handle.trim().startsWith('@') ? handle.trim().substring(1) : handle.trim();
        return this.fetchPublic<mastodon.v1.Account>(`/api/v1/accounts/lookup?acct=${fullAcct}`);
    }

    async getAccountStatuses(accountId: string, cursor?: string, excludeReplies?: boolean, excludeReposts?: boolean): Promise<MastodonPost[]> {
        const params = new URLSearchParams({ limit: '40' });
        if (cursor) params.set('max_id', cursor);
        if (excludeReplies) params.set('exclude_replies', 'true');
        if (excludeReposts) params.set('exclude_reblogs', 'true');
        const endpoint = `/api/v1/accounts/${accountId}/statuses?${params.toString()}`;
        return this.fetchPublic<MastodonPost[]>(endpoint);
    }
}

export async function getAuthenticatedMastoClient() {
    const session = await getSession();
    const accessToken = session.mastodon?.accessToken;
    const instanceUrl = session.mastodon?.instanceUrl;
    if (!accessToken || !instanceUrl) return null;
    return createRestAPIClient({ url: `https://${instanceUrl}`, accessToken });
}