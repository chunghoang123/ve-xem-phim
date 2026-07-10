import { useState, useEffect, useCallback } from "react";
import { X, Eye } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, handleImgError } from "../../lib/utils";
import { api } from "../../lib/api";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      let params = '?limit=50';
      if (statusFilter) params += `&status=${statusFilter}`;
      const res = await api.get(`/bookings${params}`);
      setBookings(res.data);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý vé đặt</h1>
          <p className="text-muted-foreground text-sm mt-1">{bookings.length} vé</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">Tất cả trạng thái</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Mã vé</th>
                <th className="text-left p-4 font-medium">Phim</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Suất chiếu</th>
                <th className="text-left p-4 font-medium">Ghế</th>
                <th className="text-left p-4 font-medium">Tổng tiền</th>
                <th className="text-left p-4 font-medium">Trạng thái</th>
                <th className="text-right p-4 font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : bookings.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="p-4 font-mono text-xs">{b.code}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <img src={b.movie_poster || ''} alt={b.movie_title} onError={handleImgError} className="w-8 h-11 rounded object-cover shrink-0" />
                      <span className="truncate max-w-[150px]">{b.movie_title}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-muted-foreground">{formatDate(b.show_date)} {b.show_time}</td>
                  <td className="p-4">{b.seats_json ? JSON.parse(b.seats_json).join(", ") : ""}</td>
                  <td className="p-4 font-semibold text-purple-400">{formatCurrency(b.total)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                      b.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {b.status === 'confirmed' ? 'Đã xác nhận' : b.status === 'cancelled' ? 'Đã hủy' : b.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => setDetail(b)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-400 transition-colors" title="Chi tiết">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && bookings.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy vé</p>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={() => setDetail(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Chi tiết vé</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mã vé</span><span className="font-mono font-semibold">{detail.code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phim</span><span>{detail.movie_title}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rạp</span><span>{detail.cinema_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Suất chiếu</span><span>{formatDate(detail.show_date)} {detail.show_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ghế</span><span>{detail.seats_json ? JSON.parse(detail.seats_json).join(", ") : ""}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tổng tiền</span><span className="font-bold text-purple-400">{formatCurrency(detail.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phương thức</span><span className="capitalize">{detail.payment_method}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái</span><span>{detail.status === 'confirmed' ? 'Đã xác nhận' : detail.status}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ngày đặt</span><span>{formatDateTime(detail.created_at)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
