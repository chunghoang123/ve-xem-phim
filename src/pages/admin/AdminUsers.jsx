import { useState, useEffect } from "react";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { api } from "../../lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${search}` : '';
      const res = await api.get(`/users?limit=50${params}`);
      setUsers(res.data);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { const t = setTimeout(fetchUsers, 300); return () => clearTimeout(t); }, [search]);

  const handleDelete = async (id) => {
    if (!confirm("Xóa người dùng này?")) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.data?.message || "Lỗi xóa người dùng");
    }
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, data);
      } else {
        await api.post('/users', data);
      }
      setShowForm(false);
      setEditing(null);
      fetchUsers();
    } catch (err) {
      alert(err.data?.message || "Lỗi lưu người dùng");
    }
  };

  const roleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-500/10 text-purple-400',
      staff: 'bg-blue-500/10 text-blue-400',
      user: 'bg-muted text-muted-foreground',
    };
    return styles[role] || styles.user;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} người dùng</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Thêm người dùng</span>
        </button>
      </div>

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm người dùng..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">ID</th>
                <th className="text-left p-4 font-medium">Tên</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Email</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">SĐT</th>
                <th className="text-left p-4 font-medium">Vai trò</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Ngày tạo</th>
                <th className="text-right p-4 font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="p-4 text-muted-foreground">{u.id}</td>
                  <td className="p-4 font-semibold">{u.name}</td>
                  <td className="p-4 hidden sm:table-cell text-muted-foreground">{u.email}</td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{u.phone || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${roleBadge(u.role_name)}`}>{u.role_name}</span>
                  </td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(u); setShowForm(true); }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-400" title="Sửa">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy người dùng</p>
        )}
      </div>

      {showForm && (
        <UserFormModal user={editing} onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function UserFormModal({ user, onSave, onClose }) {
  const [form, setForm] = useState(user ? { name: user.name, email: user.email, phone: user.phone || '', role_id: user.role_id, password: '' }
    : { name: '', email: '', phone: '', role_id: 3, password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { name: form.name, email: form.email, phone: form.phone, role_id: form.role_id };
    if (form.password) data.password = form.password;
    if (user && !form.password) {
      onSave(data);
    } else {
      onSave(data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{user ? "Sửa người dùng" : "Thêm người dùng"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Họ tên</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Số điện thoại</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Vai trò</label>
            <select value={form.role_id} onChange={(e) => setForm({...form, role_id: Number(e.target.value)})}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value={3}>Người dùng</option>
              <option value={2}>Nhân viên</option>
              <option value={1}>Quản trị viên</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {user ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
            </label>
            <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
              required={!user} minLength={6}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
            <button type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">{user ? "Lưu" : "Thêm"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
