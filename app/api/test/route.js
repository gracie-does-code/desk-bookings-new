// app/api/test/route.js
import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ 
    message: 'Test API works!',
    timestamp: new Date().toISOString() 
  });
}

export async function POST() {
  return NextResponse.json({ 
    message: 'POST works too!',
    timestamp: new Date().toISOString() 
  });
}