export const metadata = {
  title: 'Desk Bookings',
  description: 'Office desk booking system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
