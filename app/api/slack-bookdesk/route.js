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

async function showBookingModal(triggerId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const modal = {
    type: 'modal',
    callback_id: 'desk_booking_modal',
    title: {
      type: 'plain_text',
      text: '🏢 Book a Desk'
    },
    submit: {
      type: 'plain_text',
      text: 'Book Desk'
    },
    close: {
      type: 'plain_text',
      text: 'Cancel'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'staff_name',
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: {
            type: 'plain_text',
            text: 'Enter your full name'
          }
        },
        label: {
          type: 'plain_text',
          text: 'Staff Name'
        }
      },
      {
        type: 'input',
        block_id: 'booking_date',
        element: {
          type: 'datepicker',
          action_id: 'date_picker',
          initial_date: tomorrowStr,
          placeholder: {
            type: 'plain_text',
            text: 'Select a date'
          }
        },
        label: {
          type: 'plain_text',
          text: 'Date'
        }
      },
      {
        type: 'input',
        block_id: 'desk_area',
        element: {
          type: 'static_select',
          action_id: 'area_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose office location'
          },
          options: [
            {
              text: { type: 'plain_text', text: 'NCL - Monument' },
              value: 'NCL - Monument'
            },
            {
              text: { type: 'plain_text', text: 'NCL - St James' },
              value: 'NCL - St James'
            },
            {
              text: { type: 'plain_text', text: 'NCL - Kitchen' },
              value: 'NCL - Kitchen'
            },
            {
              text: { type: 'plain_text', text: 'Dallas - Desk' },
              value: 'Dallas - Desk'
            }
          ]
        },
        label: {
          type: 'plain_text',
          text: 'Office Location'
        }
      },
      {
        type: 'input',
        block_id: 'parking_space',
        element: {
          type: 'checkboxes',
          action_id: 'parking_checkbox',
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'I need a parking space'
              },
              value: 'need_parking'
            }
          ]
        },
        label: {
          type: 'plain_text',
          text: 'Parking (NCL locations only)'
        },
        optional: true
      }
    ]
  };

  try {
    const response = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: modal
      })
    });

    const result = await response.json();
    console.log('Modal open result:', result);
    return result;
  } catch (error) {
    console.error('Error opening modal:', error);
    throw error;
  }
}

async function handleModalSubmission(payload) {
  const values = payload.view.state.values;
  const staffName = values.staff_name.name_input.value;
  const bookingDate = values.booking_date.date_picker.selected_date;
  const deskArea = values.desk_area.area_select.selected_option.value;
  const needsParking = values.parking_space?.parking_checkbox?.selected_options?.length > 0;

  try {
    // Check for duplicate booking
    const { hasDuplicate, existingBooking, error: duplicateError } = await checkDuplicateBooking(staffName, bookingDate);
    
    if (duplicateError) {
      return {
        response_action: 'errors',
        errors: {
          staff_name: `Error checking existing bookings: ${duplicateError}`
        }
      };
    }

    if (hasDuplicate) {
      return {
        response_action: 'errors',
        errors: {
          staff_name: `${staffName} already has a booking on ${new Date(bookingDate).toLocaleDateString('en-GB')} at ${existingBooking.desk_area}`
        }
      };
    }

    // Check desk availability
    const areaKey = deskArea.toLowerCase().replace(/\s+/g, '_').replace('-', '');
    const { deskCount } = await getCurrentBookings(bookingDate, areaKey);
    const deskLimit = DESK_LIMITS[areaKey] || 0;

    if (deskCount >= deskLimit) {
      return {
        response_action: 'errors',
        errors: {
          desk_area: `${deskArea} is fully booked (${deskCount}/${deskLimit})`
        }
      };
    }

    // Check parking availability for NCL locations
    let parkingError = null;
    if (needsParking && deskArea.includes('NCL')) {
      const totalParking = await getTotalNCLParking(bookingDate);
      if (totalParking >= TOTAL_NCL_PARKING) {
        parkingError = `Parking is full (${totalParking}/${TOTAL_NCL_PARKING})`;
      }
    }

    if (parkingError) {
      return {
        response_action: 'errors',
        errors: {
          parking_space: parkingError
        }
      };
    }

    // Create the booking
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        employee_name: staffName,
        date: bookingDate,
        desk_area: deskArea,
        parking_space: needsParking && deskArea.includes('NCL'),
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return {
        response_action: 'errors',
        errors: {
          staff_name: `Database error: ${error.message}`
        }
      };
    }

    // Return success response
    const successText = `✅ *Desk Booked Successfully!*\n\n` +
      `👤 *Staff:* ${staffName}\n` +
      `📅 *Date:* ${new Date(bookingDate).toLocaleDateString('en-GB')}\n` +
      `🪑 *Location:* ${deskArea}` +
      `${data.parking_space ? '\n🚗 *Parking:* Reserved' : ''}`;

    return {
      response_action: 'clear'
    };

  } catch (error) {
    console.error('Error processing booking:', error);
    return {
      response_action: 'errors',
      errors: {
        staff_name: `Error: ${error.message}`
      }
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

    // ---- MODAL INTERACTION ----
    if (body.type === 'view_submission') {
      console.log('Processing modal submission');
      const result = await handleModalSubmission(body);
      return NextResponse.json(result);
    }

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

      // Default: Show booking modal
      await showBookingModal(body.trigger_id);
      return NextResponse.json({ text: 'Opening desk booking form...' });
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
EOF