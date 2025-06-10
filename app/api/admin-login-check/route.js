import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const adminToken = cookieStore.get('admin-token');
  
  return NextResponse.json({ 
    authenticated: !!adminToken?.value 
  });
}
