import { NextRequest, NextResponse } from 'next/server';
import { createRestAPIClient } from 'masto';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { instanceUrl } = await req.json();
    if (!instanceUrl) {
      return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 });
    }

    const session = await getSession();
    const fullInstanceUrl = `https://${instanceUrl}`;
    const rest = createRestAPIClient({ url: fullInstanceUrl });

    const redirectUri = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/mastodon/callback`;
    const scopes = 'read:accounts read:favourites read:bookmarks';

    const app = await rest.v1.apps.create({
      clientName: 'All My Posts',
      redirectUris: redirectUri,
      scopes: scopes,
      website: 'https://github.com/CrispStrobe/allmyposts',
    });

    // FIX: Add a check to ensure we received a valid client ID and secret.
    if (!app.clientId || !app.clientSecret) {
      throw new Error("Failed to retrieve valid client credentials from the Mastodon instance.");
    }

    // Now TypeScript knows these values are strings.
    session.mastodon = {
      instanceUrl: instanceUrl,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
    };
    await session.save();
    
    const authUrl = new URL(`${fullInstanceUrl}/oauth/authorize`);
    authUrl.searchParams.set('client_id', app.clientId); // No longer needs '!'
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    
    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Mastodon login error:", error);
    return NextResponse.json({ error: 'Failed to initiate Mastodon login.' }, { status: 500 });
  }
}