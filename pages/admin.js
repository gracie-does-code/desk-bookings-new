// pages/admin.js
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Office configurations
const OFFICE_CONFIG = {
  'NCL Monument': { capacity: 40, parking: true },
  'NCL St James': { capacity: 40, parking: true },
  'Dallas': { capacity: 10, parking: false }
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationFilter, setLocationFilter] = useState('all');

  useEffect(() => {
    // Check if already authenticated (stored in session)
    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      loadBookings();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadBookings();
    }
  }, [selectedDate, locationFilter, isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_authenticated', 'true');
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Authentication failed');
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('date', selectedDate);

      if (locationFilter !== 'all') {
        query = query.eq('location', locationFilter);
      }

      const { data, error } = await query.order('location').order('created_at');

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const deleteBooking = async (id) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadBookings();
    } catch (err) {
      console.error('Error deleting booking:', err);
      alert('Failed to delete booking');
    }
  };

  const getStats = () => {
    const totalBookings = bookings.length;
    const parkingCount = bookings.filter(b => b.parking_space).length;
    
    const locationCounts = {};
    bookings.forEach(b => {
      locationCounts[b.location] = (locationCounts[b.location] || 0) + 1;
    });

    return { totalBookings, parkingCount, locationCounts };
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>Admin Dashboard</h1>
          <form onSubmit={handleLogin} style={styles.loginForm}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.passwordInput}
              autoFocus
            />
            <button type="submit" style={styles.loginButton}>Login</button>
            {error && <p style={styles.errorText}>{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const stats = getStats();
  const groupedBookings = bookings.reduce((acc, booking) => {
    if (!acc[booking.location]) acc[booking.location] = [];
    acc[booking.location].push(booking);
    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🏢 Desk Booking Admin Dashboard</h1>
        <button 
          onClick={() => {
            sessionStorage.removeItem('admin_authenticated');
            setIsAuthenticated(false);
          }}
          style={styles.logoutButton}
        >
          Logout
        </button>
      </div>

      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Location</label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Locations</option>
            <option value="NCL Monument">NCL Monument</option>
            <option value="NCL St James">NCL St James</option>
            <option value="Dallas">Dallas</option>
          </select>
        </div>
        <button onClick={loadBookings} style={styles.refreshButton}>Refresh</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statTitle}>Total Bookings</div>
          <div style={styles.statValue}>{stats.totalBookings}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statTitle}>Parking Spaces Used</div>
          <div style={styles.statValue}>{stats.parkingCount}/6</div>
          <div style={styles.statDetail}>Newcastle offices only</div>
        </div>
        {Object.entries(OFFICE_CONFIG).map(([office, config]) => (
          <div key={office} style={styles.statCard}>
            <div style={styles.statTitle}>{office}</div>
            <div style={styles.statValue}>
              {stats.locationCounts[office] || 0}/{config.capacity}
            </div>
            <div style={styles.statDetail}>
              {config.capacity - (stats.locationCounts[office] || 0)} available
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div style={styles.emptyState}>No bookings found for {selectedDate}</div>
      ) : (
        <div style={styles.bookingsGrid}>
          {Object.entries(groupedBookings).map(([location, locationBookings]) => (
            <div key={location} style={styles.locationCard}>
              <div style={styles.locationHeader}>
                <span>{location}</span>
                <span style={styles.capacityBadge}>
                  {locationBookings.length}/{OFFICE_CONFIG[location].capacity}
                </span>
              </div>
              <div style={styles.bookingList}>
                {locationBookings.map((booking, index) => (
                  <div key={booking.id} style={styles.bookingItem}>
                    <div>
                      <div style={styles.bookingName}>
                        {index + 1}. {booking.employee_name}
                      </div>
                    </div>
                    <div style={styles.bookingDetails}>
                      {booking.parking_space && (
                        <span style={styles.parkingIcon}>🚗 Parking</span>
                      )}
                      <button
                        onClick={() => deleteBooking(booking.id)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  // Login styles
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },
  loginCard: {
    background: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  loginTitle: {
    textAlign: 'center',
    marginBottom: '30px',
    color: '#2c3e50'
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  passwordInput: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px'
  },
  loginButton: {
    padding: '12px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    margin: '10px 0 0 0'
  },

  // Dashboard styles
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  },
  logoutButton: {
    padding: '8px 16px',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  controls: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    alignItems: 'flex-end'
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontWeight: '600',
    color: '#555',
    fontSize: '0.9rem'
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  refreshButton: {
    padding: '8px 16px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statTitle: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
    marginBottom: '5px'
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#2c3e50'
  },
  statDetail: {
    fontSize: '0.85rem',
    color: '#95a5a6',
    marginTop: '5px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#7f8c8d'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#95a5a6'
  },
  bookingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px'
  },
  locationCard: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  locationHeader: {
    background: '#34495e',
    color: 'white',
    padding: '15px 20px',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  capacityBadge: {
    background: 'rgba(255,255,255,0.2)',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.85rem'
  },
  bookingList: {
    padding: '20px'
  },
  bookingItem: {
    padding: '10px 0',
    borderBottom: '1px solid #ecf0f1',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bookingName: {
    fontWeight: '500'
  },
  bookingDetails: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  parkingIcon: {
    background: '#3498db',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem'
  },
  deleteBtn: {
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    cursor: 'pointer'
  }
};