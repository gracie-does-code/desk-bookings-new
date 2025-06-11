import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with error checking
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if Supabase is initialized
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Database configuration error',
      details: 'Supabase client not initialized. Check environment variables.'
    });
  }

  try {
    // Parse Slack command data (URL-encoded form data)
    const slackData = req.body;
    
    // Verify Slack request (optional but recommended)
    // const slackSignature = req.headers['x-slack-signature'];
    // const slackTimestamp = req.headers['x-slack-request-timestamp'];
    // Add verification logic here if needed

    const { text, user_id, user_name, channel_id, response_url } = slackData;

    // Parse command text (expecting format: "book 2024-01-20" or "cancel 2024-01-20")
    const [action, date] = text.trim().split(' ');

    // Validate input
    if (!action || !date) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: 'Please use format: `/bookdesk book YYYY-MM-DD` or `/bookdesk cancel YYYY-MM-DD`'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }

    // Handle different actions
    switch (action.toLowerCase()) {
      case 'book':
        return await handleBooking(res, { user_id, user_name, date, channel_id });
      
      case 'cancel':
        return await handleCancellation(res, { user_id, date });
      
      case 'list':
        return await handleList(res, { date });
      
      default:
        return res.status(200).json({
          response_type: 'ephemeral',
          text: 'Unknown command. Use `book`, `cancel`, or `list`.'
        });
    }

  } catch (error) {
    console.error('Slack command error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'An error occurred processing your request. Please try again.'
    });
  }
}

async function handleBooking(res, { user_id, user_name, date, channel_id }) {
  try {
    // Check if user already has a booking for this date
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', date)
      .single();

    if (existingBooking) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `You already have a desk booked for ${date}`
      });
    }

    // Check desk availability (assuming max 10 desks)
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('date', date);

    if (countError) throw countError;

    if (count >= 10) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `Sorry, all desks are booked for ${date}`
      });
    }

    // Create booking
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        user_id,
        user_name,
        date,
        channel_id,
        desk_number: count + 1, // Simple desk assignment
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      response_type: 'in_channel',
      text: `✅ Desk ${newBooking.desk_number} booked for ${user_name} on ${date}`
    });

  } catch (error) {
    console.error('Booking error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Failed to create booking. Please try again.'
    });
  }
}

async function handleCancellation(res, { user_id, date }) {
  try {
    const { data: booking, error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('user_id', user_id)
      .eq('date', date)
      .select()
      .single();

    if (deleteError || !booking) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `No booking found for ${date}`
      });
    }

    return res.status(200).json({
      response_type: 'in_channel',
      text: `❌ Booking cancelled for ${date}`
    });

  } catch (error) {
    console.error('Cancellation error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Failed to cancel booking. Please try again.'
    });
  }
}

async function handleList(res, { date }) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('desk_number, user_name')
      .eq('date', date)
      .order('desk_number');

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `No bookings for ${date}`
      });
    }

    const bookingList = bookings
      .map(b => `• Desk ${b.desk_number}: ${b.user_name}`)
      .join('\n');

    return res.status(200).json({
      response_type: 'ephemeral',
      text: `📅 Bookings for ${date}:\n${bookingList}\n\n${10 - bookings.length} desks available`
    });

  } catch (error) {
    console.error('List error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Failed to retrieve bookings. Please try again.'
    });
  }
}