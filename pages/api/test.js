// pages/api/test.js

// This MUST be a default export for Pages Router API routes
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Pages API routes are working!',
    method: req.method,
    timestamp: new Date().toISOString(),
    env_check: {
      supabase_url: !!process.env.SUPABASE_URL,
      next_public_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: !!process.env.SUPABASE_ANON_KEY,
      supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      slack_token: !!process.env.SLACK_BOT_TOKEN
    }
  });
}