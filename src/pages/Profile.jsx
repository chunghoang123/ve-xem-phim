import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { User, Mail, Phone, Lock, AlertCircle, CheckCircle, Save, Ticket, CalendarDays, MapPin, Clock, Loader2, Armchair } from "lucide-react";

const bookingStatus = {
  CONFIRMED: { label: "Đã xác nhận", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  PAID: { label: "Đã thanh toán", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  CANCELLED: { label: "Đã hủy", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  EXPIRED: { label: "Đã hết hạn", className: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
};

function formatShowDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function getSeatCodes(booking) {
  if (booking.seat_codes) return booking.seat_codes;
  if (!booking.seats_json) return "—";
  try {
    const seats = typeof booking.seats_json === "string" ? JSON.parse(booking.seats_json) : booking.seats_json;
    return Array.isArray(seats) && seats.length > 0 ? seats.join(", ") : "—";
  } catch {
    return String(booking.seats_json);
  }
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingBookings(true);
    api.get('/v1/bookings/history')
      .then((response) => {
        if (active) setBookings(response.data || []);
      })
      .catch((err) => {
        if (active) setBookingError(err.data?.message || "Không thể tải lịch sử đặt vé");
      })
      .finally(() => {
        if (active) setLoadingBookings(false);
      });
    return () => { active = false; };
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setMessage(""); setError("");
    if (!name.trim()) { setError("Vui lòng nhập họ tên"); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: name.trim(), phone: phone.trim() });
      setMessage("Cập nhật thông tin thành công");
      refreshUser();
    } catch (err) { setError(err.data?.message || "Lỗi cập nhật"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPwdMsg(""); setPwdErr("");
    if (!currentPassword || !newPassword) { setPwdErr("Vui lòng nhập đầy đủ"); return; }
    if (newPassword.length < 6) { setPwdErr("Mật khẩu mới phải có ít nhất 6 ký tự"); return; }
    if (newPassword !== confirmPassword) { setPwdErr("Mật khẩu xác nhận không khớp"); return; }
    setChangingPwd(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setPwdMsg("Đổi mật khẩu thành công");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) { setPwdErr(err.data?.message || "Lỗi đổi mật khẩu"); }
    finally { setChangingPwd(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Vui lòng đăng nhập để xem trang này</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Trang cá nhân</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile info */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-purple-400" />Thông tin cá nhân</h2>
            {message && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" />{message}</div>}
            {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={user.email} disabled
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm cursor-not-allowed" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Số điện thoại"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-purple-400" />Đổi mật khẩu</h2>
            {pwdMsg && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" />{pwdMsg}</div>}
            {pwdErr && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{pwdErr}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Mật khẩu hiện tại"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Xác nhận mật khẩu mới"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <button type="submit" disabled={changingPwd}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                <Lock className="w-4 h-4" />{changingPwd ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>
            </form>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Ticket className="h-5 w-5 text-purple-400" /> Lịch sử đặt vé
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Xem lại tất cả vé đã đặt, đang chờ hoặc đã hủy.</p>
            </div>
            {!loadingBookings && (
              <span className="shrink-0 text-sm text-muted-foreground">{bookings.length} đơn</span>
            )}
          </div>

          {loadingBookings ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : bookingError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
              {bookingError}
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Bạn chưa có lịch sử đặt vé</p>
              <p className="mt-1 text-sm text-muted-foreground">Các vé đã đặt sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const normalizedStatus = String(booking.status || "").toUpperCase();
                const status = bookingStatus[normalizedStatus] || {
                  label: booking.status,
                  className: "border-border bg-muted text-muted-foreground",
                };
                return (
                  <article key={booking.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex flex-col sm:flex-row">
                      {booking.movie_poster && (
                        <img
                          src={booking.movie_poster}
                          alt={booking.movie_title}
                          className="h-44 w-full object-cover sm:h-auto sm:w-32"
                        />
                      )}
                      <div className="min-w-0 flex-1 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-bold">{booking.movie_title}</h3>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{booking.booking_code}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-purple-400" />{formatShowDate(booking.show_date)}</p>
                          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-purple-400" />{booking.show_time || "—"}</p>
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-purple-400" />{booking.cinema_name}{booking.room_name ? ` · ${booking.room_name}` : ""}</p>
                          <p className="flex items-center gap-2"><Armchair className="h-4 w-4 text-purple-400" />Ghế {getSeatCodes(booking)}</p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                          <div>
                            {booking.ticket_codes && (
                              <p className="text-xs text-muted-foreground">Mã vé: <span className="font-mono font-semibold text-foreground">{booking.ticket_codes}</span></p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">Đặt lúc {new Date(booking.created_at).toLocaleString("vi-VN")}</p>
                          </div>
                          <p className="text-lg font-black text-purple-400">{formatCurrency(booking.total)}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
