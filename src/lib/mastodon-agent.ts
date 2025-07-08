// src/lib/mastodon-agent.ts
import { type mastodon } from 'masto';

export type MastodonPost = mastodon.v1.Status;

export class MastodonAgent {
    private instanceUrl: string;

    constructor(handle: string) {
        const handleParts = handle.split('@');
        if (handleParts.length !== 3 || !handle.startsWith('@')) {
            throw new Error('Invalid Mastodon handle. Must be in the format @user@instance.tld');
        }
        this.instanceUrl = `https://${handleParts[2]}`;
    }

    // Using `unknown` is more type-safe than `any`
    private async fetchPublic(endpoint: string): Promise<unknown> {
        const response = await fetch(`${this.instanceUrl}${endpoint}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Account not found at ${this.instanceUrl}. Please check the handle and instance name.`);
            }
            throw new Error(`Mastodon API error (${response.status}): ${response.statusText}`);
        }
        return response.json();
    }

    async getAccountByHandle(handle: string): Promise<mastodon.v1.Account> {
        const username = handle.split('@')[1];
        // The calling function now safely asserts the type after fetching.
        return await this.fetchPublic(`/api/v1/accounts/lookup?acct=${username}`) as mastodon.v1.Account;
    }

    async getAccountStatuses(
        accountId: string, 
        cursor?: string, 
        excludeReplies?: boolean, 
        excludeReposts?: boolean
    ): Promise<MastodonPost[]> {
        const params = new URLSearchParams({ limit: '40' });
        if (cursor) params.set('max_id', cursor);
        if (excludeReplies) params.set('exclude_replies', 'true');
        if (excludeReposts) params.set('exclude_reblogs', 'true');
        
        const endpoint = `/api/v1/accounts/${accountId}/statuses?${params.toString()}`;
        return await this.fetchPublic(endpoint) as MastodonPost[];
    }
}