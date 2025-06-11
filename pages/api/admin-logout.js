// pages/api/admin-logout.js
import { serialize } from 'cookie';

export default function handler(req, res) {
  // Clear the authentication cookie
  res.setHeader('Set-Cookie', serialize('admin-authenticated', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: -1, // Expire immediately
    path: '/'
  }));

  return res.status(200).json({ success: true });
}