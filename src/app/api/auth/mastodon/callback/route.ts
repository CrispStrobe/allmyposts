import { NextRequest, NextResponse } from 'next/server';
import { createOAuthAPIClient } from 'masto';
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

    // FIXED: The `token` resource is directly on the oauth client, not under `v1`.
    const token = await oauth.token.create({
      code,
      clientId,
      clientSecret,
      redirectUri,
      grantType: 'authorization_code',
      scope: scopes,
    });

    session.mastodon = {
      instanceUrl,
      accessToken: token.accessToken,
    };
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  } catch (error) {
    console.error('Mastodon callback error:', error);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', req.nextUrl.origin));
  }
}