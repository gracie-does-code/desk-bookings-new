import AdminAuth from '../../components/AdminAuth';
import Admin from '../../components/Admin';

export default function AdminPage() {
  return (
    <AdminAuth>
      <Admin />
    </AdminAuth>
  );
}
