"use client";
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';

export default function BookingList() {
  const [weeklyBookings, setWeeklyBookings] = useState({})
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchWeeklyBookings()
    // eslint-disable-next-line
  }, [location])

  // Generate array of next 7 days
  const getNextSevenDays = () => {
    const days = []
    const today = new Date()
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      days.push(date.toISOString().split('T')[0])
    }
    
    return days
  }

  const fetchWeeklyBookings = async () => {
    setLoading(true)
    setErrorMsg('')
    
    const nextSevenDays = getNextSevenDays()
    const startDate = nextSevenDays[0]
    const endDate = nextSevenDays[6]

    let query = supabase
      .from('bookings')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    if (location) {
      query = query.eq('location', location)
    }

    const { data, error } = await query.order('date', { ascending: true }).order('employee_name', { ascending: true })

    if (error) {
      setErrorMsg('Failed to fetch bookings. Please try again later.')
      setWeeklyBookings({})
    } else {
      // Group bookings by date
      const groupedBookings = {}
      nextSevenDays.forEach(date => {
        groupedBookings[date] = data.filter(booking => booking.date === date)
      })
      setWeeklyBookings(groupedBookings)
    }

    setLoading(false)
  }

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    // Check if it's today or tomorrow
    if (dateString === today.toISOString().split('T')[0]) {
      return `Today (${date.toLocaleDateString('en-GB')})`
    } else if (dateString === tomorrow.toISOString().split('T')[0]) {
      return `Tomorrow (${date.toLocaleDateString('en-GB')})`
    } else {
      return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} (${date.toLocaleDateString('en-GB')})`
    }
  }

  // Get location counts for a specific date
  const getLocationCounts = (bookings) => {
    const tally = {}
    bookings.forEach((b) => {
      tally[b.location] = (tally[b.location] || 0) + 1
    })
    return tally
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          📅 Next 7 Days Bookings
        </h2>
        
        <label htmlFor="booking-location" className="flex items-center gap-2">
          <span className="font-medium">Filter by location:</span>
          <select
            id="booking-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Locations</option>
            <option value="Dallas">Dallas</option>
            <option value="UK- Newcastle Office">UK- Newcastle Office</option>
            <option value="Newcastle">Newcastle</option>
          </select>
        </label>
      </div>

      {errorMsg && (
        <div className="text-red-600 bg-red-50 border border-red-300 p-4 rounded-lg">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading weekly bookings...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(weeklyBookings).map(([date, bookings]) => {
            const locationCounts = getLocationCounts(bookings)
            
            return (
              <div key={date} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {/* Date Header */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatDate(date)}
                    </h3>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>
                  
                  {/* Location counts */}
                  {Object.keys(locationCounts).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-4">
                      {Object.entries(locationCounts).map(([loc, count]) => (
                        <span key={loc} className="text-sm text-gray-600">
                          📍 <strong>{loc}</strong>: {count} booking{count > 1 ? 's' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bookings List */}
                <div className="p-6">
                  {bookings.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">
                      No bookings for this day
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bookings.map((booking) => (
                        <div 
                          key={booking.id} 
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {booking.employee_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {booking.employee_name}
                              </span>
                              {booking.parking_space && (
                                <span className="text-blue-600" title="Has parking space">
                                  🚗
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              🪑 {booking.desk_area}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Refresh Button */}
      <div className="text-center pt-4">
        <button
          onClick={fetchWeeklyBookings}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          🔄 Refresh Bookings
        </button>
      </div>
    </div>
  )
}