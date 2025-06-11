import AdminAuth from '@/components/AdminAuth';
import AdminDashboard from '@/components/Admin';

export default function AdminPage() {
  return (
    <AdminAuth>
      <AdminDashboard />
    </AdminAuth>
  );
}