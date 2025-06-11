import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const slackToken = process.env.SLACK_BOT_TOKEN;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Office configurations
const OFFICE_CONFIG = {
  'NCL Monument': { capacity: 40, parking: true },
  'NCL St James': { capacity: 40, parking: true },
  'Dallas': { capacity: 10, parking: false }
};

// Shared parking capacity for all Newcastle offices
const NEWCASTLE_PARKING_CAPACITY = 6;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if this is a slash command or an interactive payload
  const isInteractive = req.body.payload;
  
  if (isInteractive) {
    // Handle interactive components (button clicks, modal submissions)
    return handleInteractive(req, res);
  } else {
    // Handle initial slash command
    return handleSlashCommand(req, res);
  }
}

async function handleSlashCommand(req, res) {
  const { trigger_id, user_id, user_name } = req.body;

  // Open a modal when the slash command is used
  const modal = {
    type: 'modal',
    callback_id: 'desk_booking_modal',
    title: {
      type: 'plain_text',
      text: 'Desk Booking'
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'What would you like to do?'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📅 Book a Desk'
            },
            value: 'book',
            action_id: 'action_book',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 View Bookings'
            },
            value: 'list',
            action_id: 'action_list'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❌ Cancel Booking'
            },
            value: 'cancel',
            action_id: 'action_cancel',
            style: 'danger'
          }
        ]
      }
    ]
  };

  // Send modal open request to Slack
  try {
    const response = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger_id,
        view: modal
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Failed to open modal:', result);
      return res.status(200).json({
        response_type: 'ephemeral',
        text: 'Failed to open booking interface. Please try again.'
      });
    }

    // Acknowledge the slash command
    return res.status(200).send();
    
  } catch (error) {
    console.error('Error opening modal:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'An error occurred. Please try again.'
    });
  }
}

async function handleInteractive(req, res) {
  const payload = JSON.parse(req.body.payload);
  
  // Handle different interaction types
  switch (payload.type) {
    case 'block_actions':
      return handleBlockAction(payload, res);
    case 'view_submission':
      return handleViewSubmission(payload, res);
    default:
      return res.status(200).send();
  }
}

async function handleBlockAction(payload, res) {
  const action = payload.actions[0];
  const trigger_id = payload.trigger_id;
  
  let modal;
  
  switch (action.action_id) {
    case 'action_book':
      modal = await createBookingModal();
      break;
    case 'action_list':
      modal = createListModal();
      break;
    case 'action_cancel':
      modal = await createCancelModal(payload.user.name);
      break;
    default:
      return res.status(200).send();
  }

  // Update the modal
  try {
    await fetch('https://slack.com/api/views.update', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        view_id: payload.view.id,
        view: modal
      })
    });
    
    return res.status(200).send();
  } catch (error) {
    console.error('Error updating modal:', error);
    return res.status(200).send();
  }
}

async function handleViewSubmission(payload, res) {
  const { callback_id, state, user } = payload;
  
  switch (callback_id) {
    case 'booking_submit':
      return handleBookingSubmission(payload, res);
    case 'list_submit':
      return handleListSubmission(payload, res);
    case 'cancel_submit':
      return handleCancelSubmission(payload, res);
    default:
      return res.status(200).send();
  }
}

async function createBookingModal() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // Get current bookings for tomorrow to show availability
  const availability = await getAvailabilityForDate(dateStr);
  
  // Create location options with availability info
  const locationOptions = Object.entries(OFFICE_CONFIG).map(([office, config]) => {
    const booked = availability[office] || 0;
    const available = config.capacity - booked;
    return {
      text: { 
        type: 'plain_text', 
        text: `${office} (${available}/${config.capacity} desks available)` 
      },
      value: office
    };
  });

  return {
    type: 'modal',
    callback_id: 'booking_submit',
    title: {
      type: 'plain_text',
      text: 'Book a Desk'
    },
    submit: {
      type: 'plain_text',
      text: 'Book Desk'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'date_input',
        label: {
          type: 'plain_text',
          text: 'Select Date'
        },
        element: {
          type: 'datepicker',
          action_id: 'date_select',
          initial_date: dateStr,
          placeholder: {
            type: 'plain_text',
            text: 'Select a date'
          }
        }
      },
      {
        type: 'input',
        block_id: 'location_input',
        label: {
          type: 'plain_text',
          text: 'Office Location'
        },
        element: {
          type: 'static_select',
          action_id: 'location_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select office'
          },
          options: locationOptions
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_Parking is only available at Newcastle offices (6 spaces shared between NCL Monument & NCL St James)_'
        }
      },
      {
        type: 'input',
        block_id: 'parking_input',
        label: {
          type: 'plain_text',
          text: 'Parking Space'
        },
        element: {
          type: 'checkboxes',
          action_id: 'parking_select',
          options: [
            {
              text: { type: 'plain_text', text: 'Reserve parking space (Newcastle only)' },
              value: 'parking'
            }
          ]
        },
        optional: true
      }
    ]
  };
}

function createListModal() {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    type: 'modal',
    callback_id: 'list_submit',
    title: {
      type: 'plain_text',
      text: 'View Bookings'
    },
    submit: {
      type: 'plain_text',
      text: 'View'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'date_input',
        label: {
          type: 'plain_text',
          text: 'Select Date'
        },
        element: {
          type: 'datepicker',
          action_id: 'date_select',
          initial_date: today,
          placeholder: {
            type: 'plain_text',
            text: 'Select a date'
          }
        }
      },
      {
        type: 'input',
        block_id: 'location_input',
        label: {
          type: 'plain_text',
          text: 'Filter by Office (Optional)'
        },
        element: {
          type: 'static_select',
          action_id: 'location_select',
          placeholder: {
            type: 'plain_text',
            text: 'All offices'
          },
          options: [
            {
              text: { type: 'plain_text', text: 'All Offices' },
              value: 'all'
            },
            {
              text: { type: 'plain_text', text: 'NCL Monument' },
              value: 'NCL Monument'
            },
            {
              text: { type: 'plain_text', text: 'NCL St James' },
              value: 'NCL St James'
            },
            {
              text: { type: 'plain_text', text: 'Dallas' },
              value: 'Dallas'
            }
          ]
        },
        optional: true
      }
    ]
  };
}

async function createCancelModal(userName) {
  // Get user's upcoming bookings
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, date, location, desk_area, parking_space')
    .eq('employee_name', userName)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date');

  if (!bookings || bookings.length === 0) {
    return {
      type: 'modal',
      title: {
        type: 'plain_text',
        text: 'Cancel Booking'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'You have no upcoming bookings to cancel.'
          }
        }
      ]
    };
  }

  const options = bookings.map(booking => ({
    text: {
      type: 'plain_text',
      text: `${booking.date} - ${booking.location}${booking.parking_space ? ' (with parking)' : ''}`
    },
    value: booking.id.toString()
  }));

  return {
    type: 'modal',
    callback_id: 'cancel_submit',
    title: {
      type: 'plain_text',
      text: 'Cancel Booking'
    },
    submit: {
      type: 'plain_text',
      text: 'Cancel Booking'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'booking_input',
        label: {
          type: 'plain_text',
          text: 'Select booking to cancel'
        },
        element: {
          type: 'static_select',
          action_id: 'booking_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose a booking'
          },
          options: options
        }
      }
    ]
  };
}

async function getAvailabilityForDate(date) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('location')
    .eq('date', date);

  const counts = {};
  bookings?.forEach(booking => {
    counts[booking.location] = (counts[booking.location] || 0) + 1;
  });
  
  return counts;
}

async function handleBookingSubmission(payload, res) {
  const values = payload.view.state.values;
  const date = values.date_input.date_select.selected_date;
  const location = values.location_input.location_select.selected_option.value;
  const wantsParking = values.parking_input?.parking_select?.selected_options?.length > 0;
  const userName = payload.user.name;

  console.log('Booking submission:', { date, location, wantsParking, userName });

  try {
    // Check if user already has a booking for this date
    const { data: existing } = await supabase
      .from('bookings')
      .select('*')
      .eq('employee_name', userName)
      .eq('date', date)
      .single();

    if (existing) {
      return res.status(200).json({
        response_action: 'errors',
        errors: {
          date_input: `You already have a booking for ${date} at ${existing.location}`
        }
      });
    }

    // Check if parking was requested for non-Newcastle office
    if (wantsParking && location === 'Dallas') {
      return res.status(200).json({
        response_action: 'errors',
        errors: {
          parking_input: 'Parking is only available at Newcastle offices'
        }
      });
    }

    // Get current bookings for capacity check
    const { data: bookings } = await supabase
      .from('bookings')
      .select('location, parking_space')
      .eq('date', date)
      .eq('location', location);

    const deskCount = bookings?.length || 0;
    const officeConfig = OFFICE_CONFIG[location];

    // Check desk capacity
    if (deskCount >= officeConfig.capacity) {
      return res.status(200).json({
        response_action: 'errors',
        errors: {
          location_input: `Sorry, ${location} is fully booked for ${date} (${officeConfig.capacity}/${officeConfig.capacity} desks taken)`
        }
      });
    }

    // Check parking capacity if requested
    if (wantsParking && officeConfig.parking) {
      // Get all Newcastle parking bookings for this date
      const { data: newcastleBookings } = await supabase
        .from('bookings')
        .select('parking_space')
        .eq('date', date)
        .in('location', ['NCL Monument', 'NCL St James'])
        .eq('parking_space', true);
      
      const parkingCount = newcastleBookings?.length || 0;
      if (parkingCount >= NEWCASTLE_PARKING_CAPACITY) {
        return res.status(200).json({
          response_action: 'errors',
          errors: {
            parking_input: `Sorry, all Newcastle parking spaces are taken for ${date} (${NEWCASTLE_PARKING_CAPACITY}/${NEWCASTLE_PARKING_CAPACITY} spaces taken)`
          }
        });
      }
    }

    // Create booking with sequential desk number
    const deskNumber = deskCount + 1;
    const deskArea = `${location} - Desk ${deskNumber}`;

    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        employee_name: userName,
        date,
        location,
        desk_area: deskArea,
        parking_space: wantsParking && officeConfig.parking,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    console.log('Insert result:', { newBooking, insertError });

    if (insertError) {
      console.error('Failed to insert booking:', insertError);
      throw insertError;
    }

    // Send success message to channel
    await fetch(payload.response_urls[0].response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        text: `✅ Desk booked for ${userName} on ${date}\n📍 Location: ${location}\n🪑 Desk: #${deskNumber}${wantsParking ? '\n🚗 Parking space reserved' : ''}`
      })
    });

    // Show success modal
    const successModal = {
      type: 'modal',
      title: {
        type: 'plain_text',
        text: '✅ Booking Confirmed!'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Your desk has been successfully booked!*\n\n📅 Date: *${date}*\n📍 Location: *${location}*\n🪑 Desk: *#${deskNumber}*${wantsParking ? '\n🚗 Parking: *Reserved*' : ''}\n\n_A confirmation has been posted in the channel._`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'You can cancel this booking anytime using `/bookdesk`'
            }
          ]
        }
      ]
    };

    // Update the view to show success
    return res.status(200).json({
      response_action: 'update',
      view: successModal
    });

  } catch (error) {
    console.error('Booking error:', error);
    return res.status(200).json({
      response_action: 'errors',
      errors: {
        date_input: 'Failed to create booking. Please try again.'
      }
    });
  }
}

async function handleListSubmission(payload, res) {
  const values = payload.view.state.values;
  const date = values.date_input.date_select.selected_date;
  const location = values.location_input?.location_select?.selected_option?.value;

  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('date', date);

    if (location && location !== 'all') {
      query = query.eq('location', location);
    }

    const { data: bookings } = await query.order('location').order('created_at');

    let message = `📅 *Bookings for ${date}*\n\n`;

    if (!bookings || bookings.length === 0) {
      message = `No bookings found for ${date}`;
    } else {
      // Group by location and show capacity
      const bookingsByLocation = {};
      bookings.forEach(b => {
        if (!bookingsByLocation[b.location]) {
          bookingsByLocation[b.location] = [];
        }
        bookingsByLocation[b.location].push(b);
      });

      for (const [loc, books] of Object.entries(bookingsByLocation)) {
        const config = OFFICE_CONFIG[loc];
        const parkingCount = books.filter(b => b.parking_space).length;
        
        message += `*${loc}* (${books.length}/${config.capacity} desks`;
        
        // Show combined Newcastle parking info
        if (loc === 'NCL Monument' || loc === 'NCL St James') {
          // Get total Newcastle parking count
          const allNewcastleParking = bookings
            .filter(b => (b.location === 'NCL Monument' || b.location === 'NCL St James') && b.parking_space)
            .length;
          message += `, ${allNewcastleParking}/${NEWCASTLE_PARKING_CAPACITY} total NCL parking`;
        }
        message += `)\n`;
        
        books.forEach((b, index) => {
          message += `${index + 1}. ${b.employee_name}${b.parking_space ? ' 🚗' : ''}\n`;
        });
        message += '\n';
      }
    }

    // Send results
    await fetch(payload.response_urls[0].response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: message
      })
    });

    return res.status(200).send();

  } catch (error) {
    console.error('List error:', error);
    return res.status(200).json({
      response_action: 'errors',
      errors: {
        date_input: 'Failed to retrieve bookings.'
      }
    });
  }
}

async function handleCancelSubmission(payload, res) {
  const values = payload.view.state.values;
  const bookingId = values.booking_input.booking_select.selected_option.value;

  try {
    const { data: booking } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .select()
      .single();

    if (booking) {
      await fetch(payload.response_urls[0].response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'in_channel',
          text: `❌ ${booking.employee_name} cancelled their booking for ${booking.date} at ${booking.location}${booking.parking_space ? ' (parking space released)' : ''}`
        })
      });

      // Show success modal for cancellation
      const successModal = {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: '✅ Booking Cancelled'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Your booking has been cancelled successfully!*\n\n📅 Date: *${booking.date}*\n📍 Location: *${booking.location}*${booking.parking_space ? '\n🚗 Parking space has been released' : ''}\n\n_A cancellation notice has been posted in the channel._`
            }
          }
        ]
      };

      return res.status(200).json({
        response_action: 'update',
        view: successModal
      });
    }

    return res.status(200).send();

  } catch (error) {
    console.error('Cancel error:', error);
    return res.status(200).json({
      response_action: 'errors',
      errors: {
        booking_input: 'Failed to cancel booking.'
      }
    });
  }
}