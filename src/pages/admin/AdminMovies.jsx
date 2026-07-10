import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Trash2, X, Database, RefreshCw, Star } from "lucide-react";
import { formatCurrency, handleImgError } from "../../lib/utils";
import { api } from "../../lib/api";

export default function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingMovie, setEditingMovie] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${search}&limit=50` : '?limit=50';
      const res = await api.get(`/movies${params}`);
      setMovies(res.data);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchMovies(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchMovies]);

  const handleDelete = async (id) => {
    if (!confirm("Xóa phim này?")) return;
    try {
      await api.delete(`/movies/${id}`);
      fetchMovies();
    } catch (err) {
      alert(err.data?.message || "Lỗi xóa phim");
    }
  };

  const handleSave = async (movie) => {
    try {
      if (editingMovie) {
        await api.put(`/movies/${editingMovie.id}`, movie);
      } else {
        await api.post('/movies', movie);
      }
      setShowForm(false);
      setEditingMovie(null);
      fetchMovies();
    } catch (err) {
      alert(err.data?.message || "Lỗi lưu phim");
    }
  };

  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState([]);
  const [searchingTMDB, setSearchingTMDB] = useState(false);
  const [showTMDBSearch, setShowTMDBSearch] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState("");

  const searchTMDB = async () => {
    if (!tmdbQuery.trim()) return;
    setSearchingTMDB(true);
    try {
      const res = await api.get(`/admin/tmdb/search?query=${encodeURIComponent(tmdbQuery)}`);
      setTmdbResults(res.data);
    } catch {
      setTmdbResults([]);
    } finally {
      setSearchingTMDB(false);
    }
  };

  const addFromTMDB = async (tmdbId) => {
    try {
      await api.post("/admin/tmdb/add", { tmdbId });
      setShowTMDBSearch(false);
      setTmdbQuery("");
      setTmdbResults([]);
      fetchMovies();
    } catch (err) {
      alert(err.data?.message || "Lỗi thêm phim");
    }
  };

  const handleEnrichMovie = async (id) => {
    try {
      setEnriching(true);
      const res = await api.post(`/admin/movies/enrich/${id}`);
      setEnrichMsg(res.message);
      fetchMovies();
    } catch (err) {
      setEnrichMsg(err.data?.message || "Lỗi");
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý phim</h1>
          <p className="text-muted-foreground text-sm mt-1">{movies.length} phim</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowTMDBSearch(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-semibold transition-all"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm từ TMDB</span>
          </button>
          <button
            onClick={() => { setEditingMovie(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm phim</span>
          </button>
        </div>
      </div>

      {enrichMsg && (
        <p className="text-green-400 text-sm mb-4 flex items-center gap-2">
          <RefreshCw className="w-3 h-3" /> {enrichMsg}
        </p>
      )}

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm phim..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Phim</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Thể loại</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Thời lượng</th>
                <th className="text-left p-4 font-medium">Giá vé</th>
                <th className="text-right p-4 font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : movies.filter(m => m.title.toLowerCase().includes(search.toLowerCase())).map((movie) => (
                <tr key={movie.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={movie.poster || ''} alt={movie.title} onError={handleImgError} className="w-10 h-14 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate max-w-[200px]">{movie.title}</p>
                        <p className="text-xs text-muted-foreground">{movie.rating}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-muted-foreground">{movie.genre?.split(",")[0]}</td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{movie.duration} phút</td>
                  <td className="p-4">
                    <p className="font-semibold text-purple-400">{formatCurrency(movie.ticket_price)}</p>
                    <p className="text-xs text-muted-foreground">VIP: {formatCurrency(movie.vip_price)}</p>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!movie.tmdb_id && (
                        <button
                          onClick={() => handleEnrichMovie(movie.id)}
                          disabled={enriching}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-400 transition-colors"
                          title="Cập nhật từ TMDB"
                        >
                          <RefreshCw className={`w-4 h-4 ${enriching ? "animate-spin" : ""}`} />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingMovie(movie); setShowForm(true); }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-400 transition-colors"
                        title="Sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(movie.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && movies.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy phim</p>
        )}
      </div>

      {showForm && (
        <MovieFormModal
          movie={editingMovie}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingMovie(null); }}
        />
      )}

      {showTMDBSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={() => setShowTMDBSearch(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold">Tìm phim từ TMDB</h2>
              <button onClick={() => { setShowTMDBSearch(false); setTmdbResults([]); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <input type="text" value={tmdbQuery} onChange={(e) => setTmdbQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchTMDB()}
                  placeholder="Nhập tên phim cần tìm..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={searchTMDB} disabled={searchingTMDB}
                  className="px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Search className="w-4 h-4" /> Tìm
                </button>
              </div>
              {searchingTMDB && <p className="text-center py-8 text-muted-foreground">Đang tìm...</p>}
              {!searchingTMDB && tmdbResults.length === 0 && tmdbQuery && (
                <p className="text-center py-8 text-muted-foreground">Không tìm thấy phim</p>
              )}
              <div className="space-y-3">
                {tmdbResults.map((item) => (
                  <div key={item.tmdbId}
                    className="flex items-center gap-4 bg-muted/50 rounded-xl p-3 border border-border hover:border-purple-500/30 transition-all">
                    <img src={item.poster || ''} alt={item.title} onError={handleImgError}
                      className="w-12 h-16 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.genres}</p>
                      <p className="text-xs text-muted-foreground">{item.releaseDate?.split("-")[0] || ""}</p>
                    </div>
                    {item.voteAverage > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400" /> {item.voteAverage.toFixed(1)}
                      </span>
                    )}
                    <button onClick={() => addFromTMDB(item.tmdbId)}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-medium transition-colors shrink-0">
                      Thêm
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MovieFormModal({ movie, onSave, onClose }) {
  const [form, setForm] = useState(
    movie || {
      title: "", genre: "", duration: 120, rating: "T13",
      poster: "", backdrop: "", director: "", cast: "",
      description: "", releaseDate: "", showtimes: [],
      ticketPrice: 75000, vipPrice: 120000,
    }
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{movie ? "Sửa phim" : "Thêm phim"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tên phim</label>
              <input type="text" value={form.title} onChange={(e) => handleChange("title", e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Thể loại</label>
              <input type="text" value={form.genre} onChange={(e) => handleChange("genre", e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Thời lượng (phút)</label>
              <input type="number" value={form.duration} onChange={(e) => handleChange("duration", Number(e.target.value))} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phân loại</label>
              <select value={form.rating} onChange={(e) => handleChange("rating", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="P">P</option><option value="T13">T13</option><option value="T16">T16</option><option value="T18">T18</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ngày khởi chiếu</label>
              <input type="date" value={form.releaseDate} onChange={(e) => handleChange("releaseDate", e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Đạo diễn</label>
              <input type="text" value={form.director} onChange={(e) => handleChange("director", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Diễn viên</label>
              <input type="text" value={form.cast} onChange={(e) => handleChange("cast", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mô tả</label>
              <textarea value={form.description} onChange={(e) => handleChange("description", e.target.value)} rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Poster URL</label>
              <input type="url" value={form.poster} onChange={(e) => handleChange("poster", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Backdrop URL</label>
              <input type="url" value={form.backdrop} onChange={(e) => handleChange("backdrop", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Giá thường (VNĐ)</label>
              <input type="number" value={form.ticketPrice} onChange={(e) => handleChange("ticketPrice", Number(e.target.value))} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Giá VIP (VNĐ)</label>
              <input type="number" value={form.vipPrice} onChange={(e) => handleChange("vipPrice", Number(e.target.value))} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">
              Hủy
            </button>
            <button type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">
              {movie ? "Lưu" : "Thêm phim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
