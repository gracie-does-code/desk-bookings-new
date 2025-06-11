import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with error checking
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
    
    const { text, user_id, user_name, channel_id, response_url } = slackData;

    // Parse command text (expecting format: "book 2024-01-20 location" or "cancel 2024-01-20")
    const parts = text.trim().split(' ');
    const action = parts[0];
    const date = parts[1];
    const location = parts.slice(2).join(' '); // Join remaining parts as location

    // Validate input
    if (!action || !date) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: 'Please use format: `/bookdesk book YYYY-MM-DD location` or `/bookdesk cancel YYYY-MM-DD`'
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
        return await handleBooking(res, { user_id, user_name, date, location, channel_id });
      
      case 'cancel':
        return await handleCancellation(res, { user_id, date });
      
      case 'list':
        return await handleList(res, { date, location });
      
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

async function handleBooking(res, { user_id, user_name, date, location, channel_id }) {
  try {
    // Check if user already has a booking for this date
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('employee_name', user_name)
      .eq('date', date)
      .single();

    if (existingBooking) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `You already have a desk booked for ${date} at ${existingBooking.location}`
      });
    }

    // Get available desks for the location and date
    const { data: bookings, error: countError } = await supabase
      .from('bookings')
      .select('desk_area')
      .eq('date', date)
      .eq('location', location || 'Newcastle');

    if (countError) throw countError;

    // Find next available desk area (you might want to customize this logic)
    const bookedDesks = bookings.map(b => b.desk_area);
    const availableDesks = ['NCL - Monument', 'NCL - St James', 'NCL - Other'];
    const availableDesk = availableDesks.find(desk => !bookedDesks.includes(desk));

    if (!availableDesk) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `Sorry, all desks are booked for ${date} at ${location || 'Newcastle'}`
      });
    }

    // Create booking
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        employee_name: user_name,
        date,
        location: location || 'Newcastle',
        desk_area: availableDesk,
        parking_space: false, // Default to no parking
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      response_type: 'in_channel',
      text: `✅ Desk booked for ${user_name} on ${date}\n📍 Location: ${newBooking.location}\n🪑 Desk: ${newBooking.desk_area}`
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
    // Note: Using user_id as employee_name for now - you might want to map these
    const { data: booking, error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('employee_name', user_id)
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
      text: `❌ Booking cancelled for ${date} at ${booking.location}`
    });

  } catch (error) {
    console.error('Cancellation error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Failed to cancel booking. Please try again.'
    });
  }
}

async function handleList(res, { date, location }) {
  try {
    let query = supabase
      .from('bookings')
      .select('desk_area, employee_name, parking_space')
      .eq('date', date);

    // Add location filter if provided
    if (location) {
      query = query.eq('location', location);
    }

    const { data: bookings, error } = await query.order('desk_area');

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `No bookings for ${date}${location ? ' at ' + location : ''}`
      });
    }

    const bookingList = bookings
      .map(b => `• ${b.desk_area}: ${b.employee_name}${b.parking_space ? ' 🚗' : ''}`)
      .join('\n');

    return res.status(200).json({
      response_type: 'ephemeral',
      text: `📅 Bookings for ${date}${location ? ' at ' + location : ''}:\n${bookingList}`
    });

  } catch (error) {
    console.error('List error:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Failed to retrieve bookings. Please try again.'
    });
  }
}