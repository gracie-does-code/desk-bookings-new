// app/page.jsx
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            🏢 Desk Booking System
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Book your workspace effortlessly. Reserve desks, parking spaces, and coordinate with your team.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Quick Booking Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">🪑</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Quick Booking</h3>
            <p className="text-gray-600 mb-4">
              Reserve your desk for today or upcoming days. Choose from Newcastle or Dallas locations.
            </p>
            <div className="text-sm text-gray-500">
              Use <code className="bg-gray-100 px-2 py-1 rounded">/bookdesk</code> in Slack
            </div>
          </div>

          {/* Locations Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">📍</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Our Locations</h3>
            <div className="text-gray-600 space-y-2">
              <div>
                <strong>Newcastle:</strong>
                <ul className="list-disc list-inside text-sm mt-1">
                  <li>Monument (40 desks)</li>
                  <li>St James (40 desks)</li>
                  <li>Kitchen (15 desks)</li>
                </ul>
              </div>
              <div>
                <strong>Dallas:</strong>
                <ul className="list-disc list-inside text-sm mt-1">
                  <li>Desk Area (10 desks)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Parking Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">🚗</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Parking</h3>
            <p className="text-gray-600 mb-4">
              6 parking spaces available at Newcastle locations. Reserve your spot when booking a desk.
            </p>
            <div className="text-sm text-gray-500">
              Available for NCL locations only
            </div>
          </div>

          {/* Admin Panel Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Admin Panel</h3>
            <p className="text-gray-600 mb-4">
              Manage bookings, view analytics, and configure system settings.
            </p>
            <a 
              href="/admin" 
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Go to Admin
            </a>
          </div>

          {/* Slack Commands Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Slack Commands</h3>
            <div className="text-gray-600 space-y-2">
              <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                /bookdesk
              </div>
              <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                /bookdesk list [date]
              </div>
              <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                /bookdesk cancel [date]
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">System Status</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Booking System Online</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Slack Integration Active</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Database Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mt-12 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Quick Start Guide</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">1️⃣</span>
              </div>
              <h3 className="font-semibold mb-2">Open Slack</h3>
              <p className="text-gray-600 text-sm">Go to any channel or DM in your workspace</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">2️⃣</span>
              </div>
              <h3 className="font-semibold mb-2">Type Command</h3>
              <p className="text-gray-600 text-sm">Use <code>/bookdesk</code> to start booking</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">3️⃣</span>
              </div>
              <h3 className="font-semibold mb-2">Complete Booking</h3>
              <p className="text-gray-600 text-sm">Fill out the form and submit your booking</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-gray-500">
            Need help? Contact your IT team or check the admin panel for more options.
          </p>
        </div>
      </div>
    </div>
  );
}