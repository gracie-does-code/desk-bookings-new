import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Fresh Next.js API works!',
    timestamp: new Date().toISOString() 
  });
}
