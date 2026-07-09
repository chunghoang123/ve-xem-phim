import { useState, useEffect } from "react";
import { Search, Plus, Trash2, X } from "lucide-react";
import { formatCurrency, formatDate, handleImgError } from "../../lib/utils";
import { api } from "../../lib/api";

export default function AdminShowtimes() {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMovie, setSearchMovie] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = searchMovie ? `?search=${searchMovie}` : '';
      const res = await api.get(`/showtimes?limit=50${params}`);
      setShowtimes(res.data);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); fetchMovies(); }, []);

  const fetchMovies = async () => {
    try {
      const res = await api.get('/movies?limit=50');
      setMovies(res.data);
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa lịch chiếu này?")) return;
    try {
      await api.delete(`/showtimes/${id}`);
      fetchData();
    } catch (err) {
      alert(err.data?.message || "Lỗi xóa lịch chiếu");
    }
  };

  const handleSave = async (data) => {
    try {
      await api.post('/showtimes', data);
      setShowForm(false);
      fetchData();
    } catch (err) {
      alert(err.data?.message || "Lỗi thêm lịch chiếu");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý lịch chiếu</h1>
          <p className="text-muted-foreground text-sm mt-1">{showtimes.length} suất chiếu</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm suất chiếu</span>
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Phim</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Rạp</th>
                <th className="text-left p-4 font-medium">Ngày</th>
                <th className="text-left p-4 font-medium">Giờ</th>
                <th className="text-right p-4 font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : showtimes.map((st) => (
                <tr key={st.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={st.movie_poster || ''} alt={st.movie_title} onError={handleImgError} className="w-10 h-14 rounded-lg object-cover shrink-0" />
                      <p className="font-semibold text-sm truncate max-w-[200px]">{st.movie_title}</p>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-muted-foreground">{st.cinema_name}</td>
                  <td className="p-4">{formatDate(st.date)}</td>
                  <td className="p-4 font-semibold">{st.time}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(st.id)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && showtimes.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy lịch chiếu</p>
        )}
      </div>

      {showForm && (
        <ShowtimeFormModal
          movies={movies}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ShowtimeFormModal({ movies, onSave, onClose }) {
  const [form, setForm] = useState({ movie_id: "", cinema_id: "1", date: "", time: "" });
  const [cinemas, setCinemas] = useState([]);

  useEffect(() => {
    api.get("/cinemas?limit=200").then(res => setCinemas(res.data)).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.movie_id || !form.date || !form.time) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    onSave({ ...form, movie_id: Number(form.movie_id), cinema_id: Number(form.cinema_id) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">Thêm suất chiếu</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phim</label>
            <select value={form.movie_id} onChange={(e) => setForm({ ...form, movie_id: e.target.value })} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Chọn phim...</option>
              {movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rạp</label>
            <select value={form.cinema_id} onChange={(e) => setForm({ ...form, cinema_id: e.target.value })} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Chọn rạp...</option>
              {cinemas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.brand ? `[${c.brand}] ` : ''}{c.name} - {c.district || c.city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ngày chiếu</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Giờ chiếu</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
            <button type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">Thêm</button>
          </div>
        </form>
      </div>
    </div>
  );
}
