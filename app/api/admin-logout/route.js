import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.json({ success: true });
  
  // Clear admin authentication cookie
  response.cookies.set('admin-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0
  });
  
  return response;
}
