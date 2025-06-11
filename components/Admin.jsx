"use client";
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase';

function AdminDashboard() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [stats, setStats] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState(null)

  const areas = ['NCL - Monument', 'NCL - St James', 'NCL - Kitchen', 'Dallas - Desk']

  useEffect(() => {
    // Load today's bookings on component mount
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    loadBookings(today)
  }, [])

  // Function to check for duplicate bookings
  const checkForDuplicates = (bookingsData) => {
    const duplicates = []
    const seen = new Map()

    bookingsData.forEach(booking => {
      const key = `${booking.employee_name.toLowerCase().trim()}-${booking.date}`
      
      if (seen.has(key)) {
        // Found a duplicate
        const existing = seen.get(key)
        if (!duplicates.find(d => d.key === key)) {
          duplicates.push({
            key,
            employee_name: booking.employee_name,
            date: booking.date,
            bookings: [existing, booking]
          })
        } else {
          // Add to existing duplicate group
          const duplicateGroup = duplicates.find(d => d.key === key)
          duplicateGroup.bookings.push(booking)
        }
      } else {
        seen.set(key, booking)
      }
    })

    return duplicates
  }

  const loadBookings = async (date = selectedDate) => {
    setLoading(true)
    setMessage('')
    
    try {
      console.log('Loading bookings for date:', date)
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', date)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading bookings:', error)
        setMessage(`❌ Error loading bookings: ${error.message}`)
        setBookings([])
      } else {
        console.log('Loaded bookings:', data)
        setBookings(data || [])
        calculateStats(data || [])
        
        // Check for duplicates
        const duplicates = checkForDuplicates(data || [])
        if (duplicates.length > 0) {
          setMessage(
            `⚠️ Found ${duplicates.length} employees with multiple bookings for this date! ` +
            `Total bookings: ${data?.length || 0}`
          )
        } else {
          setMessage(
            data?.length 
              ? `✅ Loaded ${data.length} bookings (no duplicates found)` 
              : '📭 No bookings found for this date'
          )
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage(`❌ Error: ${error.message}`)
      setBookings([])
    }
    
    setLoading(false)
  }

  const calculateStats = (bookingsData) => {
    const areaCounts = {
      'NCL - Monument': 0,
      'NCL - St James': 0,
      'NCL - Kitchen': 0,
      'Dallas - Desk': 0
    }
    
    let parkingCount = 0
    
    bookingsData.forEach(booking => {
      if (areaCounts.hasOwnProperty(booking.desk_area)) {
        areaCounts[booking.desk_area]++
      }
      if (booking.parking_space) {
        parkingCount++
      }
    })
    
    setStats({
      areas: areaCounts,
      parking: parkingCount,
      total: bookingsData.length
    })
  }

  const handleDeleteClick = (booking) => {
    setBookingToDelete(booking)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!bookingToDelete) return
    
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingToDelete.id)

      if (error) {
        setMessage(`❌ Error deleting booking: ${error.message}`)
      } else {
        setMessage(`✅ Deleted booking for ${bookingToDelete.employee_name}`)
        loadBookings() // Reload bookings
      }
    } catch (error) {
      console.error('Error deleting booking:', error)
      setMessage(`❌ Error: ${error.message}`)
    }
    
    setShowDeleteModal(false)
    setBookingToDelete(null)
  }

  // Enhanced filtering to highlight duplicates
  const getFilteredBookingsWithDuplicates = () => {
    const filtered = bookings.filter(booking => {
      const matchesSearch = booking.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesArea = selectedArea === '' || booking.desk_area === selectedArea
      return matchesSearch && matchesArea
    })

    const duplicates = checkForDuplicates(filtered)
    const duplicateEmployeeDates = new Set(duplicates.map(d => d.key))

    return filtered.map(booking => ({
      ...booking,
      isDuplicate: duplicateEmployeeDates.has(`${booking.employee_name.toLowerCase().trim()}-${booking.date}`)
    }))
  }

  const exportToCSV = () => {
    const filteredBookings = getFilteredBookingsWithDuplicates()
    const headers = ['Employee Name', 'Desk Area', 'Date', 'Parking', 'Location', 'Is Duplicate']
    const csvData = filteredBookings.map(booking => [
      booking.employee_name,
      booking.desk_area,
      booking.date,
      booking.parking_space ? 'Yes' : 'No',
      booking.location,
      booking.isDuplicate ? 'Yes' : 'No'
    ])
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `desk-bookings-${selectedDate}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB')
  }

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getAreaColor = (area) => {
    const colors = {
      'NCL - Monument': 'bg-blue-100 text-blue-800 border-blue-200',
      'NCL - St James': 'bg-green-100 text-green-800 border-green-200',
      'NCL - Kitchen': 'bg-purple-100 text-purple-800 border-purple-200',
      'Dallas - Desk': 'bg-orange-100 text-orange-800 border-orange-200'
    }
    return colors[area] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getUsageColor = (current, total) => {
    const percentage = (current / total) * 100
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-orange-600'
    return 'text-green-600'
  }

  // Get filtered bookings with duplicate detection
  const filteredBookings = getFilteredBookingsWithDuplicates()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🏢 Admin Dashboard
              </h1>
              <p className="text-gray-600 text-lg">
                Manage desk bookings and view analytics
              </p>
            </div>
            
            <div className="flex items-center gap-3 mt-4 lg:mt-0">
              <button
                onClick={exportToCSV}
                disabled={filteredBookings.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                📊 Export CSV
              </button>
              
              <a
                href="/"
                className="bg-gray-600 text-white px-4 py-2 rounded-xl hover:bg-gray-700 flex items-center gap-2 transition-all"
              >
                🏠 Booking Form
              </a>
            </div>
          </div>
          
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🔍 Search Employee</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🏢 Filter by Area</label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Areas</option>
                {areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => loadBookings()}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    🔄 Load Bookings
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Message */}
          {message && (
            <div className={`mt-6 p-4 rounded-xl ${
              message.includes('❌') 
                ? 'bg-red-50 border border-red-200 text-red-800' 
                : message.includes('📭')
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                : message.includes('⚠️')
                ? 'bg-orange-50 border border-orange-200 text-orange-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              <p className="font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">NCL Monument</p>
                  <p className={`text-3xl font-bold ${getUsageColor(stats.areas?.['NCL - Monument'] || 0, 40)}`}>
                    {stats.areas?.['NCL - Monument'] || 0}/40
                  </p>
                </div>
                <div className="text-4xl">🏢</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">NCL Kitchen</p>
                  <p className={`text-3xl font-bold ${getUsageColor(stats.areas?.['NCL - Kitchen'] || 0, 15)}`}>
                    {stats.areas?.['NCL - Kitchen'] || 0}/15
                  </p>
                </div>
                <div className="text-4xl">🍽️</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Dallas Desk</p>
                  <p className={`text-3xl font-bold ${getUsageColor(stats.areas?.['Dallas - Desk'] || 0, 10)}`}>
                    {stats.areas?.['Dallas - Desk'] || 0}/10
                  </p>
                </div>
                <div className="text-4xl">🌟</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Parking Used</p>
                  <p className={`text-3xl font-bold ${getUsageColor(stats.parking || 0, 6)}`}>
                    {stats.parking || 0}/6
                  </p>
                </div>
                <div className="text-4xl">🚗</div>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Bookings for {selectedDate ? formatDate(selectedDate) : 'Selected Date'}
              </h2>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>
          </div>
          
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600">
                {searchTerm || selectedArea 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No bookings found for this date'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Desk Area
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Parking
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className={`hover:bg-gray-50 transition-colors ${
                        booking.isDuplicate ? 'bg-red-50 border-l-4 border-red-400' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                            booking.isDuplicate ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            <span className={`font-semibold ${
                              booking.isDuplicate ? 'text-red-600' : 'text-blue-600'
                            }`}>
                              {booking.employee_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {booking.employee_name}
                              {booking.parking_space && (
                                <span className="text-blue-600" title="Has parking space">
                                  🚗
                                </span>
                              )}
                              {booking.isDuplicate && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  DUPLICATE
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {booking.location}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getAreaColor(booking.desk_area)}`}>
                          {booking.desk_area}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(booking.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.parking_space ? (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                            🚗 Yes
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteClick(booking)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Booking</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete the booking for{' '}
                  <strong>{bookingToDelete?.employee_name}</strong>?
                  <br />
                  <span className="text-sm">This action cannot be undone.</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-xl hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard