// pages/api/admin-auth.js

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authenticated = password === adminPassword;

  return res.status(200).json({ authenticated });
}