import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CreditCard, Smartphone, Building2, Check, PartyPopper, AlertCircle } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { useAuth } from "../components/Navbar";
import { api } from "../lib/api";

const paymentMethods = [
  { id: "momo", name: "Ví MoMo", icon: Smartphone, color: "from-pink-500 to-pink-600" },
  { id: "zalopay", name: "ZaloPay", icon: Smartphone, color: "from-blue-500 to-blue-600" },
  { id: "atm", name: "ATM/Visa", icon: CreditCard, color: "from-amber-500 to-amber-600" },
  { id: "bank", name: "Chuyển khoản", icon: Building2, color: "from-green-500 to-green-600" },
];

export default function Checkout() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const seats = searchParams.get("seats")?.split(",") || [];
  const time = searchParams.get("time") || "10:00";
  const date = searchParams.get("date") || "";
  const cinemaId = Number(searchParams.get("cinema")) || 1;
  const total = Number(searchParams.get("total")) || 0;
  const showtimeId = Number(searchParams.get("showtimeId")) || 1;

  const [movie, setMovie] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState("momo");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/movies/${id}`),
      api.get(`/cinemas/${cinemaId}`),
    ]).then(([movieRes, cinemaRes]) => {
      setMovie(movieRes.data);
      setCinema(cinemaRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, cinemaId]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center animate-scale">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Vui lòng đăng nhập</h2>
          <p className="text-muted-foreground text-sm mb-6">Bạn cần đăng nhập để đặt vé. Vui lòng đăng nhập hoặc đăng ký tài khoản.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate(-1)}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Quay lại</button>
            <Link to="/"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 text-center">Đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-muted-foreground">Không tìm thấy phim</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16 w-full">
        <div className="max-w-sm w-full text-center animate-scale">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-lg shadow-green-500/25">
            <PartyPopper className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Đặt vé thành công!</h1>
          <p className="text-muted-foreground text-sm mb-6 sm:mb-8">Vé của bạn đã được xác nhận. Kiểm tra email để nhận mã vé.</p>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 text-left">
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Phim</span>
                <span className="font-medium text-right truncate">{movie.title}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Rạp</span>
                <span className="font-medium text-right">{cinema?.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Suất</span>
                <span className="font-medium text-right">{date} • {time}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Ghế</span>
                <span className="font-medium text-right">{seats.join(", ")}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-medium">Tổng cộng</span>
                <span className="font-bold text-purple-400 text-base sm:text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/" className="flex-1 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-medium">Về trang chủ</Link>
            <Link to="/movies" className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">Đặt vé khác</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await api.post('/bookings', {
        showtime_id: showtimeId,
        seats,
        payment_method: payment,
      });
      setDone(true);
    } catch (err) {
      setError(err.data?.message || "Đặt vé thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-12 sm:pb-16 w-full">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pt-3 sm:pt-4">
          <button onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Thanh toán</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter">
          <h2 className="font-semibold text-sm sm:text-base mb-4">Thông tin đặt vé</h2>
          <div className="flex gap-3 sm:gap-4">
            <img src={movie.poster} alt={movie.title} className="w-16 sm:w-20 rounded-xl object-cover shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">{movie.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{cinema?.name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{date} • {time}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Ghế: {seats.join(", ")}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter" style={{ animationDelay: "0.1s" }}>
          <h2 className="font-semibold text-sm sm:text-base mb-4">Phương thức thanh toán</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {paymentMethods.map((method) => (
              <button key={method.id} onClick={() => setPayment(method.id)}
                className={`flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border transition-all text-left ${
                  payment === method.id ? "border-purple-500/50 bg-purple-500/10" : "border-border bg-background hover:border-purple-500/30"
                }`}>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0 ${method.color}`}>
                  <method.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate">{method.name}</p>
                  {payment === method.id && <Check className="w-4 h-4 text-purple-400 mt-0.5" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter" style={{ animationDelay: "0.15s" }}>
          <h2 className="font-semibold text-sm sm:text-base mb-4">Mã giảm giá</h2>
          <div className="flex gap-2.5 sm:gap-3">
            <input type="text" placeholder="Nhập mã giảm giá..."
              className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm min-w-0" />
            <button className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-muted border border-border text-sm font-semibold hover:bg-border transition-colors shrink-0">Áp dụng</button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter" style={{ animationDelay: "0.2s" }}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vé ({seats.length}x)</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí dịch vụ</span>
              <span className="text-green-400">Miễn phí</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="font-medium text-sm sm:text-base">Tổng cộng</span>
              <span className="text-lg sm:text-xl font-bold text-purple-400">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full px-6 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-base sm:text-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25 animate-enter disabled:opacity-50"
          style={{ animationDelay: "0.25s" }}>
          {submitting ? "Đang xử lý..." : `Xác nhận thanh toán ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  );
}
