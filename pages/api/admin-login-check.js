// pages/api/admin-login-check.js
import { parse } from 'cookie';

export default function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const isAuthenticated = cookies['admin-authenticated'] === 'true';
  
  return res.status(200).json({ authenticated: isAuthenticated });
}