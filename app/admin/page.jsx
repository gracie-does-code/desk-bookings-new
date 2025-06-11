import AdminAuth from '../components/AdminAuth.jsx';
import Admin from '../components/Admin.jsx';

export default function AdminPage() {
  return (
    <AdminAuth>
      <AdminDashboard />
    </AdminAuth>
  );
}