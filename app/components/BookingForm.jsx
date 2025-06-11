"use client";
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase';

export default function BookingForm() {
  const [staffList, setStaffList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [deskArea, setDeskArea] = useState('')
  const [parkingNeeded, setParkingNeeded] = useState(false)
  const [bookingDate, setBookingDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [availability, setAvailability] = useState({})
  const [showSuccess, setShowSuccess] = useState(false)

  // Desk area configuration - mapping to match your current database
  const DESK_AREAS = {
    'NCL - Monument': { name: 'NCL - Monument', limit: 40, location: 'ncl' },
    'NCL - St James': { name: 'NCL - St James', limit: 40, location: 'ncl' },
    'NCL - Kitchen': { name: 'NCL - Kitchen', limit: 15, location: 'ncl' },
    'Dallas - Desk': { name: 'Dallas - Desk', limit: 10, location: 'dallas' }
  }

  const TOTAL_NCL_PARKING = 6

  // Filter staff based on search term
  const filteredStaff = staffList.filter(staff =>
    staff.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    async function loadStaff() {
      console.log('Loading staff from database...')
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('id, full_name, email')
          .order('full_name', { ascending: true })

        if (error) {
          console.error('Failed to load staff:', error)
          setMessage('❌ Failed to load staff list')
        } else {
          console.log('Loaded staff:', data?.length, 'people')
          setStaffList(data || [])
        }
      } catch (err) {
        console.error('Error loading staff:', err)
        setMessage('❌ Error connecting to database')
      }
    }
    loadStaff()
  }, [])

  // Load availability when date changes
  useEffect(() => {
    if (bookingDate) {
      loadAvailability()
    }
  }, [bookingDate])

  // NEW: Function to check if staff member already has a booking for the selected date
  const checkExistingBooking = async (staffName, selectedDate) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('employee_name', staffName)
        .eq('date', selectedDate)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected when no booking exists
        console.error('Error checking existing booking:', error)
        return { hasBooking: false, error: error.message }
      }

      return { hasBooking: !!data, existingBooking: data }
    } catch (error) {
      console.error('Error checking booking:', error)
      return { hasBooking: false, error: error.message }
    }
  }

  const loadAvailability = async () => {
    console.log('🔍 Loading availability for date:', bookingDate)
    
    try {
      // First check what columns exist in your bookings table
      const { data: sampleBooking, error: sampleError } = await supabase
        .from('bookings')
        .select('*')
        .limit(1)

      if (sampleBooking && sampleBooking.length > 0) {
        console.log('📊 Available columns in bookings table:', Object.keys(sampleBooking[0]))
      }

      // Try different possible column names for parking
      let parkingColumn = 'parking_space' // Default from your original code
      
      // Query bookings for the selected date
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`desk_area, ${parkingColumn}, location, date`)
        .eq('date', bookingDate)

      if (error) {
        console.error('Error loading availability:', error)
        // Try alternative column name
        if (error.message.includes('parking_space')) {
          parkingColumn = 'parking_needed'
          console.log('Trying alternative parking column name...')
          
          const { data: bookings2, error: error2 } = await supabase
            .from('bookings')
            .select(`desk_area, ${parkingColumn}, location, date`)
            .eq('date', bookingDate)
            
          if (error2) {
            console.error('Still error with alternative column:', error2)
            return
          } else {
            console.log('✅ Success with alternative column')
            processBookings(bookings2, parkingColumn)
          }
        }
        return
      }

      console.log('📅 Current bookings for', bookingDate, ':', bookings)
      processBookings(bookings, parkingColumn)

    } catch (error) {
      console.error('Error in loadAvailability:', error)
    }
  }

  const processBookings = (bookings, parkingColumn) => {
    // Calculate availability for each area
    const newAvailability = {}
    let totalNCLParking = 0

    // Initialize counts
    Object.keys(DESK_AREAS).forEach(key => {
      newAvailability[key] = {
        booked: 0,
        available: DESK_AREAS[key].limit,
        total: DESK_AREAS[key].limit
      }
    })

    // Count bookings
    bookings.forEach(booking => {
      // Check desk area booking
      if (newAvailability[booking.desk_area]) {
        newAvailability[booking.desk_area].booked++
        newAvailability[booking.desk_area].available--
      }
      
      // Count parking (only for NCL locations)
      if (booking[parkingColumn] && (booking.location === 'Newcastle' || booking.desk_area?.startsWith('NCL'))) {
        totalNCLParking++
      }
    })

    newAvailability.parking = {
      booked: totalNCLParking,
      available: TOTAL_NCL_PARKING - totalNCLParking,
      total: TOTAL_NCL_PARKING
    }

    console.log('📊 Calculated availability:', newAvailability)
    setAvailability(newAvailability)
  }

  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff)
    setSearchTerm(staff.full_name)
    setShowDropdown(false)
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setShowDropdown(true)
    if (selectedStaff && selectedStaff.full_name !== e.target.value) {
      setSelectedStaff(null)
    }
  }

  const getAvailabilityDisplay = (areaKey) => {
    const avail = availability[areaKey]
    if (!avail) return null
    
    const percentage = Math.round((avail.booked / avail.total) * 100)
    let colorClass = 'text-green-600'
    let bgColorClass = 'bg-green-100'
    
    if (avail.available === 0) {
      colorClass = 'text-red-600'
      bgColorClass = 'bg-red-100'
    } else if (avail.available <= 3) {
      colorClass = 'text-orange-600'
      bgColorClass = 'bg-orange-100'
    }

    return (
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded text-xs font-medium ${bgColorClass} ${colorClass}`}>
          {avail.available}/{avail.total} available
        </span>
        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              avail.available === 0 ? 'bg-red-500' : 
              avail.available <= 3 ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  const validateDate = (date) => {
    const today = new Date()
    const selectedDate = new Date(date)
    const twoWeeksFromNow = new Date(today)
    twoWeeksFromNow.setDate(today.getDate() + 14)

    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    twoWeeksFromNow.setHours(23, 59, 59, 999)

    if (selectedDate < today) {
      return 'Cannot book for past dates'
    }
    if (selectedDate > twoWeeksFromNow) {
      return 'Cannot book more than 2 weeks in advance'
    }
    return null
  }

  const handleSubmit = async () => {
    if (!selectedStaff || !bookingDate || !deskArea) {
      setMessage('❌ Please fill in all required fields')
      return
    }

    const dateError = validateDate(bookingDate)
    if (dateError) {
      setMessage(`❌ ${dateError}`)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // NEW: Check if staff member already has a booking for this date
      console.log('🔍 Checking for existing booking...')
      const { hasBooking, existingBooking, error: checkError } = await checkExistingBooking(
        selectedStaff.full_name,
        bookingDate
      )

      if (checkError) {
        setMessage(`❌ Error checking existing bookings: ${checkError}`)
        setLoading(false)
        return
      }

      if (hasBooking) {
        setMessage(
          `❌ ${selectedStaff.full_name} already has a booking for ${new Date(bookingDate).toLocaleDateString('en-GB')}! ` +
          `Current booking: ${existingBooking.desk_area}${existingBooking.parking_space ? ' + Parking' : ''}`
        )
        setLoading(false)
        return
      }

      // NEW: Check area capacity
      const areaAvailability = availability[deskArea]
      if (areaAvailability && areaAvailability.available <= 0) {
        setMessage(`❌ ${deskArea} is fully booked for this date`)
        setLoading(false)
        return
      }

      // NEW: Check parking capacity if needed
      if (parkingNeeded && deskArea.startsWith('NCL')) {
        const parkingAvailability = availability.parking
        if (parkingAvailability && parkingAvailability.available <= 0) {
          setMessage(`❌ Parking is fully booked for this date (${parkingAvailability.booked}/${parkingAvailability.total} spaces taken)`)
          setLoading(false)
          return
        }
      }

      // Check what location the selected staff belongs to
      const staffLocation = selectedStaff.location || 'Newcastle' // Default to Newcastle if not specified

      console.log('📝 Submitting booking with data:', {
        employee_name: selectedStaff.full_name,
        location: staffLocation,
        desk_area: deskArea,
        parking_space: parkingNeeded,
        date: bookingDate
      })

      // Use the column names from your original booking form
      const bookingData = {
        employee_name: selectedStaff.full_name,
        location: staffLocation,
        desk_area: deskArea,
        parking_space: parkingNeeded,
        date: bookingDate
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()

      setLoading(false)
      
      if (error) {
        console.error('❌ Booking error:', error)
        
        // NEW: Handle specific constraint violation
        if (error.code === '23505' && error.constraint === 'unique_employee_date') {
          setMessage(`❌ ${selectedStaff.full_name} already has a booking for this date! Please check existing bookings.`)
        } else {
          setMessage(`❌ Booking failed: ${error.message}`)
        }
      } else {
        console.log('✅ Booking successful:', data)
        
        // Show success animation
        setShowSuccess(true)
        setMessage(`✅ Desk booked successfully for ${selectedStaff.full_name}!${parkingNeeded ? ' 🚗' : ''}`)
        
        // Hide success animation after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000)
        
        // Reset booking form
        setBookingDate('')
        setDeskArea('')
        setParkingNeeded(false)
        setSelectedStaff(null)
        setSearchTerm('')
        
        // Reload availability
        await loadAvailability()
      }
    } catch (error) {
      console.error('❌ Error submitting booking:', error)
      setMessage(`❌ Booking failed: ${error.message}`)
      setLoading(false)
    }
  }

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 14)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🏢 Book Your Desk
          </h1>
          <p className="text-gray-600 text-lg">
            Reserve your workspace for the perfect productive day
          </p>
        </div>

        {/* Success Animation */}
        {showSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-green-500 text-white px-8 py-6 rounded-2xl shadow-2xl animate-bounce">
              <div className="text-3xl font-bold text-center">🎉 Booking Confirmed! 🎉</div>
              <div className="text-center mt-2 opacity-90">Your desk is reserved!</div>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
            <h2 className="text-2xl font-bold text-white">Reservation Details</h2>
          </div>
          
          <div className="p-8 space-y-6">
            {/* Staff Selection */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Staff Member *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Start typing your name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                />
                
                {showDropdown && filteredStaff.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 max-h-48 overflow-y-auto z-20 shadow-lg">
                    {filteredStaff.map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => handleStaffSelect(staff)}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                      >
                        <div className="font-medium text-gray-900">{staff.full_name}</div>
                        <div className="text-sm text-gray-500">{staff.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showDropdown && searchTerm && filteredStaff.length === 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 p-3 text-gray-500 shadow-lg">
                    No staff found matching "{searchTerm}"
                  </div>
                )}
              </div>
              
              {selectedStaff && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ Selected: <strong>{selectedStaff.full_name}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Booking Date *
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={today}
                max={maxDateStr}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                You can book up to 2 weeks in advance
              </p>
            </div>

            {/* Desk Area Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏢 Desk Location *
              </label>
              <div className="space-y-3">
                {Object.entries(DESK_AREAS).map(([key, area]) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      deskArea === key 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="deskArea"
                        value={key}
                        checked={deskArea === key}
                        onChange={(e) => setDeskArea(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        deskArea === key 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {deskArea === key && (
                          <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{area.name}</span>
                    </div>
                    <div className="flex items-center">
                      {availability[key] && getAvailabilityDisplay(key)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Parking Option - Only for NCL */}
            {deskArea && deskArea.startsWith('NCL') && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={parkingNeeded}
                      onChange={(e) => setParkingNeeded(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">🚗 I need a parking space</span>
                      <p className="text-sm text-gray-600">NCL locations only</p>
                    </div>
                  </div>
                  <div>
                    {availability.parking && getAvailabilityDisplay('parking')}
                  </div>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Booking...
                </div>
              ) : (
                '🎯 Book My Desk'
              )}
            </button>

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-xl ${
                message.includes('❌') 
                  ? 'bg-red-50 border border-red-200 text-red-800' 
                  : 'bg-green-50 border border-green-200 text-green-800'
              }`}>
                <p className="font-medium">{message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Admin Link */}
        <div className="text-center mt-8 space-y-3">
          <p className="text-sm text-gray-500">
            Need help? Contact IT support or check availability with <code>/bookdesk</code> in Slack
          </p>
          
          {/* Admin Dashboard Link */}
          <div>
            <a 
              href="/admin" 
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
            >
              🔧 Admin Dashboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}