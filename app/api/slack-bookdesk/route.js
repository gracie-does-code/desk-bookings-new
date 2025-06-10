// app/api/slack-bookdesk/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const DESK_LIMITS = {
  'ncl_monument': 40,
  'ncl_st_james': 40,
  'ncl_kitchen': 15,
  'dallas_desk': 10
};
const TOTAL_NCL_PARKING = 6;

// Helper functions
async function getCurrentBookings(date, area) {
  const areaMap = {
    'ncl_monument': ['NCL - Monument', 'ncl_monument'],
    'ncl_st_james': ['NCL - St James', 'ncl_st_james'], 
    'ncl_kitchen': ['NCL - Kitchen', 'ncl_kitchen'],
    'dallas_desk': ['dallas_desk']
  };
  const searchValues = areaMap[area] || [area];
  const { data, error } = await supabase
    .from('bookings')
    .select('parking_space, desk_area')
    .eq('date', date)
    .in('desk_area', searchValues);
  if (error) return { deskCount: 0, parkingCount: 0 };
  const deskCount = data.length;
  const parkingCount = data.filter(booking => booking.parking_space).length;
  return { deskCount, parkingCount };
}

async function getTotalNCLParking(date) {
  const { data, error } = await supabase
    .from('bookings')
    .select('parking_space')
    .eq('date', date)
    .in('desk_area', [
      'NCL - Monument', 'NCL - St James', 'NCL - Kitchen',
      'ncl_monument', 'ncl_st_james', 'ncl_kitchen'
    ])
    .eq('parking_space', true);
  if (error) return 0;
  return data.length;
}

async function checkDuplicateBooking(staffName, date) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('employee_name', staffName)
    .eq('date', date)
    .single();
  if (error && error.code !== 'PGRST116') return { hasDuplicate: false, error: error.message };
  return { hasDuplicate: !!data, existingBooking: data };
}

async function handleListBookings(targetDate) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', targetDate)
      .order('employee_name');

    if (error) {
      return {
        text: `❌ Error fetching bookings: ${error.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!bookings || bookings.length === 0) {
      return {
        text: `📅 No bookings found for ${new Date(targetDate).toLocaleDateString('en-GB')}`,
        response_type: 'ephemeral'
      };
    }

    // Group bookings by area
    const bookingsByArea = {};
    let totalParking = 0;

    bookings.forEach(booking => {
      const area = booking.desk_area;
      if (!bookingsByArea[area]) {
        bookingsByArea[area] = [];
      }
      bookingsByArea[area].push(booking);
      if (booking.parking_space) {
        totalParking++;
      }
    });

    let responseText = `📋 *Desk Bookings for ${new Date(targetDate).toLocaleDateString('en-GB')}*\n\n`;

    Object.keys(bookingsByArea).forEach(area => {
      const areaBookings = bookingsByArea[area];
      const limit = DESK_LIMITS[area] || 'Unknown';
      responseText += `🏢 *${area.replace('_', ' ').toUpperCase()}* (${areaBookings.length}/${limit})\n`;
      
      areaBookings.forEach(booking => {
        const parkingIcon = booking.parking_space ? ' 🚗' : '';
        responseText += `  • ${booking.employee_name}${parkingIcon}\n`;
      });
      responseText += '\n';
    });

    responseText += `🅿️ *Total Parking:* ${totalParking}/${TOTAL_NCL_PARKING} NCL spaces used`;

    return {
      text: responseText,
      response_type: 'ephemeral'
    };

  } catch (error) {
    return {
      text: `❌ Error: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleCancelBooking(userName, userId, targetDate) {
  try {
    // Look up the user's full name
    let staffName = userName;
    const { data: staffData } = await supabase
      .from('staff')
      .select('full_name, email')
      .or(`email.ilike.${userName}@%,slack_id.eq.${userId}`)
      .limit(1);
    
    if (staffData && staffData[0]) {
      staffName = staffData[0].full_name;
    }

    // Find existing booking
    const { data: existingBooking, error: findError } = await supabase
      .from('bookings')
      .select('*')
      .eq('employee_name', staffName)
      .eq('date', targetDate)
      .single();

    if (findError && findError.code === 'PGRST116') {
      return {
        text: `❌ No booking found for ${staffName} on ${new Date(targetDate).toLocaleDateString('en-GB')}`,
        response_type: 'ephemeral'
      };
    }

    if (findError) {
      return {
        text: `❌ Error checking booking: ${findError.message}`,
        response_type: 'ephemeral'
      };
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', existingBooking.id);

    if (deleteError) {
      return {
        text: `❌ Error cancelling booking: ${deleteError.message}`,
        response_type: 'ephemeral'
      };
    }

    const cancelText = `✅ *Booking Cancelled Successfully!*\n\n` +
      `👤 *Staff:* ${staffName}\n` +
      `📅 *Date:* ${new Date(targetDate).toLocaleDateString('en-GB')}\n` +
      `🪑 *Location:* ${existingBooking.desk_area.replace('_', ' ').toUpperCase()}` +
      `${existingBooking.parking_space ? '\n🚗 *Parking:* Cancelled' : ''}`;

    return {
      text: cancelText,
      response_type: 'ephemeral'
    };

  } catch (error) {
    return {
      text: `❌ Error: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request) {
  console.log('=== SLACK API CALLED ===');
  
  try {
    const contentType = request.headers.get('content-type');
    let body;
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const payload = formData.get('payload');
      if (payload) {
        body = JSON.parse(payload);
      } else {
        body = Object.fromEntries(formData);
      }
    } else {
      body = await request.json();
    }

    console.log('Parsed body:', body);
    console.log('Command:', body?.command);

    // ---- SLASH COMMAND ----
    if (body.command === '/bookdesk') {
      console.log('Processing /bookdesk command');
      
      const text = body.text?.trim() || '';
      const args = text.split(' ');
      const subCommand = args[0]?.toLowerCase();

      // Handle list/cancel commands
      if (subCommand === 'list' || subCommand === 'admin') {
        const targetDate = args[1] || new Date().toISOString().split('T')[0];
        const listResponse = await handleListBookings(targetDate);
        return NextResponse.json(listResponse);
      }
      
      if (subCommand === 'cancel') {
        const targetDate = args[1] || new Date().toISOString().split('T')[0];
        const cancelResponse = await handleCancelBooking(body.user_name, body.user_id, targetDate);
        return NextResponse.json(cancelResponse);
      }

      // For now, return a simple test response until we implement the full modal
      return NextResponse.json({
        text: '🏢 Desk booking API is working! Full modal functionality coming next...',
        response_type: 'ephemeral'
      });
    }

    return NextResponse.json({
      text: 'API received your request but no command found',
      response_type: 'ephemeral'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}