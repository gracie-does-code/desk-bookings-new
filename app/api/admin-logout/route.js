import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  cookies().delete('admin-authenticated');
  return NextResponse.json({ success: true });
}

export async function POST() {
  cookies().delete('admin-authenticated');
  return NextResponse.json({ success: true });
}