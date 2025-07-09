// src/app/api/auth/mastodon/logout/route.ts
import { getSession } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const session = await getSession();
    session.destroy();
    
    // Redirect back to the homepage after logout
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
}