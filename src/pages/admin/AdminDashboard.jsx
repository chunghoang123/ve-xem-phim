import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Film, Users, Calendar, Database, RefreshCw, Check, AlertCircle } from "lucide-react";
import { formatCurrency } from "../../lib/utils";
import { api } from "../../lib/api";

export default function AdminDashboard() {
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [users, setUsers] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/movies?limit=1"),
      api.get("/showtimes?limit=1"),
      api.get("/bookings?limit=5"),
      api.get("/users?limit=1"),
    ]).then(([mRes, sRes, bRes, uRes]) => {
      setMovies(mRes.pagination?.total || 0);
      setShowtimes(sRes.pagination?.total || 0);
      setBookings(bRes.data || []);
      setUsers(uRes.pagination?.total || 0);
    }).catch(() => {});

    api.get("/admin/sync/status").then(res => setSyncStatus(res.data)).catch(() => {});
  }, []);

  const handleSync = async (type) => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await api.post("/admin/sync/tmdb", { type, pages: 1 });
      setSyncMessage(`Đã đồng bộ ${res.data.synced} phim`);
    } catch (err) {
      setSyncMessage(err.data?.message || "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
    }
  };

  const stats = [
    { label: "Tổng phim", value: movies, icon: Film, color: "from-purple-500 to-pink-500" },
    { label: "Suất chiếu", value: showtimes, icon: Calendar, color: "from-blue-500 to-cyan-500" },
    { label: "Người dùng", value: users, icon: Users, color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Tổng quan</h1>
        <p className="text-muted-foreground text-sm mt-1">Bảng điều khiển quản trị CineX</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</span>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* TMDB Sync */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold text-base">Đồng bộ phim từ TMDB</h2>
        </div>
        {syncStatus && (
          <div className="text-xs text-muted-foreground mb-3">
            TMDB: {syncStatus.tmdb_movies} phim | Tổng: {syncStatus.total_movies} phim |
            Lần cuối: {syncStatus.last_sync ? new Date(syncStatus.last_sync).toLocaleString("vi-VN") : "chưa đồng bộ"}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => handleSync("now_playing")} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Đồng bộ phim đang chiếu
          </button>
          <button onClick={() => handleSync("popular")} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Phim phổ biến
          </button>
          <button onClick={() => handleSync("upcoming")} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Phim sắp chiếu
          </button>
        </div>
        {syncMessage && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            {syncMessage.includes("thành công") || syncMessage.includes("Đã") || syncMessage.includes("cập nhật") ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={syncMessage.includes("thành công") || syncMessage.includes("Đã") || syncMessage.includes("cập nhật") ? "text-green-400" : "text-red-400"}>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* Enrich movies */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-base">Cập nhật poster & trailer</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Tự động tìm kiếm phim trên TMDB và cập nhật poster, backdrop, trailer cho các phim đang thiếu dữ liệu.</p>
        <button onClick={() => {
          setSyncing(true); setSyncMessage("");
          api.post("/admin/movies/enrich-all").then(res => {
            setSyncMessage(res.message);
          }).catch(err => {
            setSyncMessage(err.data?.message || "Lỗi cập nhật");
          }).finally(() => setSyncing(false));
        }} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Cập nhật tất cả
        </button>
      </div>

      {/* Recent Bookings */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Đặt vé gần đây</h2>
          <Link to="/admin/bookings" className="text-xs text-purple-400 hover:underline">Xem tất cả</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs border-b border-border">
                <th className="text-left py-3 px-2">Mã vé</th>
                <th className="text-left py-3 px-2">Phim</th>
                <th className="text-left py-3 px-2">Ghế</th>
                <th className="text-right py-3 px-2">Tổng</th>
                <th className="text-right py-3 px-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-xs">Chưa có đặt vé</td></tr>
              ) : bookings.map((b) => (
                <tr key={b.id} className="border-b border-border/50">
                  <td className="py-3 px-2 font-medium">{b.code}</td>
                  <td className="py-3 px-2 truncate max-w-[120px]">{b.movie_title || "Không có"}</td>
                  <td className="py-3 px-2">{b.seats_json ? JSON.parse(b.seats_json).join(", ") : "Không có"}</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(b.total)}</td>
                  <td className="py-3 px-2 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      b.status === "confirmed" ? "bg-green-500/10 text-green-400" :
                      b.status === "cancelled" ? "bg-red-500/10 text-red-400" :
                      "bg-amber-500/10 text-amber-400"
                    }`}>{b.status === "confirmed" ? "Đã xác nhận" : b.status === "cancelled" ? "Đã hủy" : b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
