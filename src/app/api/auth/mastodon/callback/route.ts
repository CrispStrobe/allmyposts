// src/app/api/auth/mastodon/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthAPIClient, createRestAPIClient } from 'masto';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.nextUrl.origin));
  }

  const { instanceUrl, clientId, clientSecret } = session.mastodon || {};

  if (!instanceUrl || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?error=session_expired', req.nextUrl.origin));
  }

  try {
    const oauth = createOAuthAPIClient({ url: `https://${instanceUrl}` });
    const redirectUri = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/mastodon/callback`;
    const scopes = 'read:accounts read:favourites read:bookmarks';

    // This token fetch logic from your original file is correct.
    const token = await oauth.token.create({
      code,
      clientId,
      clientSecret,
      redirectUri,
      grantType: 'authorization_code',
      scope: scopes,
    });
    
    // --- START: ADDED LOGIC ---
    // After getting the token, create an authenticated REST client...
    const loggedInMasto = createRestAPIClient({
        url: `https://${instanceUrl}`,
        accessToken: token.accessToken,
    });
    // ...to fetch the user's account details and get their ID.
    const account = await loggedInMasto.v1.accounts.verifyCredentials();
    // --- END: ADDED LOGIC ---

    session.mastodon = {
      instanceUrl,
      accessToken: token.accessToken,
      userId: account.id, // Save the user's ID to the session
    };
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  } catch (error) {
    console.error('Mastodon callback error:', error);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', req.nextUrl.origin));
  }
}