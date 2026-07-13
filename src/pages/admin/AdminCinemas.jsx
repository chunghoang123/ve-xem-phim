import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import Pagination from "../../components/Pagination";

export default function AdminCinemas() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const fetchCinemas = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${search}&page=${page}&limit=10` : `?page=${page}&limit=10`;
      const res = await api.get(`/cinemas${params}`);
      setCinemas(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => { const t = setTimeout(fetchCinemas, 300); return () => clearTimeout(t); }, [fetchCinemas]);

  const handleDelete = async (id) => {
    if (!confirm("Xóa rạp này?")) return;
    try {
      await api.delete(`/cinemas/${id}`);
      fetchCinemas();
    } catch (err) {
      alert(err.data?.message || "Lỗi xóa rạp");
    }
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await api.put(`/cinemas/${editing.id}`, data);
      } else {
        await api.post('/cinemas', data);
      }
      setShowForm(false);
      setEditing(null);
      fetchCinemas();
    } catch (err) {
      alert(err.data?.message || "Lỗi lưu rạp");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý rạp chiếu</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} rạp</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Thêm rạp</span>
        </button>
      </div>

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm rạp..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">ID</th>
                <th className="text-left p-4 font-medium">Tên rạp</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Thương hiệu</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Địa chỉ</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Khu vực</th>
                <th className="text-right p-4 font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : cinemas.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="p-4 text-muted-foreground text-xs">{c.id}</td>
                  <td className="p-4 font-semibold">{c.name}</td>
                  <td className="p-4 hidden md:table-cell">
                    {c.brand && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs font-medium">{c.brand}</span>}
                  </td>
                  <td className="p-4 hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{c.address}</td>
                  <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{c.district && `${c.district}, ${c.city}`}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(c); setShowForm(true); }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-400" title="Sửa">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)}
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
        {!loading && cinemas.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy rạp</p>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold">{editing ? "Sửa rạp" : "Thêm rạp"}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); handleSave({
              name: fd.get('name'), address: fd.get('address'),
              brand: fd.get('brand'), district: fd.get('district'),
              city: fd.get('city'), lat: fd.get('lat') || null, lng: fd.get('lng') || null,
            }); }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tên rạp</label>
                  <input name="name" defaultValue={editing?.name || ''} required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Thương hiệu</label>
                  <input name="brand" defaultValue={editing?.brand || ''} placeholder="CGV, Lotte, Beta..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Địa chỉ</label>
                <input name="address" defaultValue={editing?.address || ''} required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quận/Huyện</label>
                  <input name="district" defaultValue={editing?.district || ''}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Thành phố</label>
                  <input name="city" defaultValue={editing?.city || 'Hà Nội'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Vĩ độ (lat)</label>
                  <input name="lat" defaultValue={editing?.lat || ''} placeholder="21.0285"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Kinh độ (lng)</label>
                  <input name="lng" defaultValue={editing?.lng || ''} placeholder="105.8042"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
                <button type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">{editing ? "Lưu" : "Thêm"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
