import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, AlertCircle, Loader2, Clock, Check, Copy, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatCurrency } from "../lib/utils";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";

export default function Checkout() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const holdCode = searchParams.get("holdCode") || "";

  const [movie, setMovie] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [embeddedPayment, setEmbeddedPayment] = useState(null);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [now, setNow] = useState(Date.now());
  const holdConsumed = useRef(false);
  const payOSCheckoutRef = useRef(null);

  const cinemaId = Number(searchParams.get("cinema")) || 1;

  useEffect(() => {
    Promise.all([
      api.get(`/movies/${id}`),
      api.get(`/cinemas/${cinemaId}`),
    ]).then(([movieRes, cinemaRes]) => {
      setMovie(movieRes.data);
      setCinema(cinemaRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, cinemaId]);

  useEffect(() => {
    if (!payment || payment.status !== 'PENDING') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/v1/payments/${payment.payment_code}/status`);
        setPayment((current) => current ? {
          ...current,
          account_name: res.data.account_name || current.account_name,
          account_number: res.data.account_number || current.account_number,
          bank_bin: res.data.bank_bin || current.bank_bin,
          qr_code: res.data.qr_code || current.qr_code,
        } : current);
        if (res.data.payment_status === 'PAID') {
          setPaymentStatus('paid');
          setShowPaymentScreen(false);
          clearInterval(interval);
        } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(res.data.payment_status)) {
          setPaymentStatus(res.data.payment_status.toLowerCase());
          setShowPaymentScreen(false);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [payment]);

  useEffect(() => {
    if (!payment?.expires_at || paymentStatus !== 'pending') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [payment, paymentStatus]);

  useEffect(() => {
    if (!embeddedPayment) return undefined;

    const frame = requestAnimationFrame(() => {
      if (!window.PayOSCheckout?.usePayOS) {
        setError("Không thể tải khung thanh toán PayOS. Vui lòng kiểm tra kết nối và thử lại.");
        setEmbeddedPayment(null);
        return;
      }

      const returnUrl = `${window.location.origin}/payment/success?orderCode=${embeddedPayment.order_code}`;
      payOSCheckoutRef.current = window.PayOSCheckout.usePayOS({
        RETURN_URL: returnUrl,
        ELEMENT_ID: "payos-checkout-container",
        CHECKOUT_URL: embeddedPayment.checkout_url,
        embedded: true,
        onSuccess: () => {
          setError("");
          setPaymentStatus("pending");
          setEmbeddedPayment(null);
        },
        onCancel: async () => {
          setEmbeddedPayment(null);
          try {
            await api.post(`/v1/payments/order/${embeddedPayment.order_code}/cancel`, {});
          } catch {
            // The status poll reconciles when PayOS has already processed it.
          }
          setPaymentStatus("cancelled");
        },
        onExit: () => setEmbeddedPayment(null),
      });
      payOSCheckoutRef.current.open();
    });

    return () => {
      cancelAnimationFrame(frame);
      const checkout = payOSCheckoutRef.current;
      payOSCheckoutRef.current = null;
      checkout?.exit?.();
    };
  }, [embeddedPayment]);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      let activeBooking = booking;
      if (!activeBooking) {
        const bookingRes = await api.post('/v1/bookings', { seat_hold_code: holdCode });
        activeBooking = bookingRes.data;
        holdConsumed.current = true;
        setBooking(activeBooking);
      }

      const payRes = await api.post('/v1/payments/payos', { booking_code: activeBooking.booking_code });
      setPayment(payRes.data);
      setPaymentStatus('pending');
      setShowPaymentScreen(true);
    } catch (err) {
      setError(err.data?.message || "Không thể tạo đơn đặt vé");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (holdCode && !holdConsumed.current) {
      try {
        await api.delete(`/v1/seat-holds/${holdCode}`);
        holdConsumed.current = true;
      } catch {
        // The server will automatically expire an unreleased hold.
      }
    }
    navigate(-1);
  };

  const openPayOS = (paymentToOpen = payment) => {
    if (!paymentToOpen?.checkout_url) return;

    if (!window.PayOSCheckout?.usePayOS) {
      setError("Không thể tải khung thanh toán PayOS. Vui lòng kiểm tra kết nối và thử lại.");
      return;
    }
    setError("");
    setEmbeddedPayment(paymentToOpen);
  };

  const copyText = async (value, field) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1600);
    } catch {
      setError("Không thể sao chép. Vui lòng sao chép thủ công.");
    }
  };

  const cancelPayment = async () => {
    try {
      await api.post(`/v1/payments/order/${payment.order_code}/cancel`, {});
      setShowPaymentScreen(false);
      setPaymentStatus("cancelled");
      navigate("/profile?tab=bookings");
    } catch (err) {
      setError(err.data?.message || "Không thể hủy giao dịch. Vui lòng thử lại.");
    }
  };

    if (!authLoading && !user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center animate-scale">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Vui lòng đăng nhập</h2>
          <p className="text-muted-foreground text-sm mb-6">Bạn cần đăng nhập để đặt vé.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate(-1)}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Quay lại</button>
            <Link to="/"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold text-center">Về trang chủ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">Vui lòng đăng nhập từ nút "Đăng nhập" trên thanh điều hướng.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Đang tải...</p>
      </div>
    );
  }

  if (paymentStatus === 'paid') {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4 w-full">
        <div className="max-w-sm w-full text-center animate-scale">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-lg shadow-green-500/25">
            <Check className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Đặt vé thành công!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Thanh toán đã được xác nhận. Vé đã được gửi đến email của bạn.
          </p>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-6 text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Phim</span><span className="font-medium">{movie?.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rạp</span><span className="font-medium">{cinema?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mã đặt vé</span><span className="font-mono font-bold text-purple-400">{booking?.booking_code}</span></div>
          </div>
          <div className="flex gap-3">
            <Link to="/" className="flex-1 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-center">Về trang chủ</Link>
            <Link to="/profile" className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold text-center">Xem vé</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!holdCode) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Không có thông tin đặt vé</h2>
          <p className="text-muted-foreground text-sm mb-6">Vui lòng chọn ghế trước khi thanh toán.</p>
          <Link to={`/movies/${id}/seats?${searchParams.toString()}`}
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold">Chọn ghế</Link>
        </div>
      </div>
    );
  }

  // Step 2: Payment created - show QR and pay options
  if (payment) {
    const timeLeft = payment.expires_at ? Math.max(0, Math.floor((new Date(payment.expires_at).getTime() - now) / 1000)) : 0;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="min-h-screen pt-16 sm:pt-20 pb-12 sm:pb-16 w-full">
        <div className="w-full max-w-3xl mx-auto px-5 sm:px-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center">Thanh toán đơn hàng</h1>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-5 text-sm text-amber-400 text-center">
            <Clock className="w-4 h-4 inline mr-1" />
            Thời gian còn lại: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          {['cancelled', 'expired', 'failed'].includes(paymentStatus) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 text-sm text-red-400 text-center">
              Giao dịch không còn hiệu lực. Vui lòng chọn lại ghế để tạo đơn mới.
            </div>
          )}

          {showPaymentScreen && (
            <div className="fixed inset-0 z-[250] overflow-y-auto bg-background text-foreground">
              <div className="min-h-full">
                <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
                  <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">CineX</p>
                      <h1 className="truncate text-lg font-bold sm:text-xl">Thanh toán vé xem phim</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-400">
                        <Clock className="h-4 w-4" />
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </header>

                <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                  <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(400px,1.1fr)]">
                    <section className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-5 text-center shadow-xl shadow-black/10 sm:p-8">
                      <div className="rounded-3xl bg-white p-3 shadow-2xl shadow-black/20 sm:p-5">
                        <QRCodeSVG
                          value={payment.qr_code}
                          size={280}
                          level="M"
                          includeMargin
                          className="h-auto w-full max-w-[280px]"
                        />
                      </div>
                      <h2 className="mt-5 text-lg font-bold">Quét mã QR để thanh toán</h2>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Mở ứng dụng ngân hàng, chọn quét QR và kiểm tra đúng số tiền trước khi xác nhận.
                      </p>
                      <p className="mt-4 text-3xl font-black text-purple-400">{formatCurrency(payment.amount)}</p>
                    </section>

                    <section className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-black/10 sm:p-7">
                      <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-400">Chuyển khoản ngân hàng</p>
                        <h2 className="mt-1 text-xl font-bold">Thông tin thanh toán</h2>
                        <p className="mt-1 text-sm text-muted-foreground">QR và thông tin chuyển khoản đã được gộp chung trên một màn hình.</p>
                      </div>

                      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background/40">
                        {[
                          ["Chủ tài khoản", payment.account_name, "account"],
                          ["Số tài khoản", payment.account_number, "number"],
                          ["Mã ngân hàng", payment.bank_bin, "bank"],
                          ["Số tiền", formatCurrency(payment.amount), "amount"],
                          ["Nội dung chuyển khoản", payment.description, "description"],
                          ["Mã đặt vé", booking.booking_code, "booking"],
                        ].map(([label, value, field]) => (
                          <div key={field} className="flex items-center gap-3 px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className={`mt-0.5 break-all font-semibold ${field === "amount" ? "text-lg text-purple-400" : "font-mono text-sm"}`}>
                                {value || "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(value, field)}
                              disabled={!value}
                              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {copiedField === field ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                              {copiedField === field ? "Đã sao chép" : "Sao chép"}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5">
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-purple-400">Thông tin vé</h3>
                        <div className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
                          {[
                            ["Phim", booking.movie_name || movie?.title],
                            ["Rạp", booking.cinema_name || cinema?.name],
                            ["Địa chỉ", booking.cinema_address || cinema?.address],
                            ["Phòng chiếu", booking.room_name],
                            ["Vị trí ghế", Array.isArray(booking.seat_codes) ? booking.seat_codes.join(", ") : booking.seat_codes],
                            ["Ngày chiếu", booking.show_date],
                            ["Giờ chiếu", booking.show_time],
                          ].map(([label, value]) => (
                            <div key={label} className={label === "Địa chỉ" ? "sm:col-span-2" : ""}>
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="mt-0.5 text-sm font-semibold">{value || "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-300">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>Vui lòng chuyển đúng số tiền và giữ nguyên nội dung chuyển khoản. Vé sẽ được xác nhận tự động sau khi ngân hàng báo giao dịch thành công.</p>
                      </div>
                    </section>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={cancelPayment}
                      className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Hủy giao dịch
                    </button>
                  </div>
                </main>
              </div>
            </div>
          )}

          <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Đơn hàng đang chờ thanh toán</p>
                <p className="mt-1 font-mono text-sm font-bold">{booking.booking_code}</p>
                <p className="mt-2 text-2xl font-black text-purple-400">{formatCurrency(payment.amount)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentScreen(true)}
                disabled={timeLeft === 0 || paymentStatus !== 'pending'}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mở màn hình thanh toán
              </button>
            </div>
          </div>

          {embeddedPayment && (<div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/20 animate-enter">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-bold">Chuyển khoản qua PayOS</h2>
                <p className="text-xs text-muted-foreground">Quét QR hoặc mở ứng dụng ngân hàng để thanh toán</p>
              </div>
              {embeddedPayment ? (
                <button
                  type="button"
                  onClick={() => setEmbeddedPayment(null)}
                  className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Ẩn khung thanh toán"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openPayOS()}
                  disabled={timeLeft === 0 || paymentStatus !== 'pending'}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ExternalLink className="h-4 w-4" /> Mở PayOS
                </button>
              )}
            </div>

            {embeddedPayment && (
              <div id="payos-checkout-container" className="h-[72vh] min-h-[480px] max-h-[680px] w-full bg-white" />
            )}

            <div className="border-t border-border p-4 sm:p-5">
              <h3 className="mb-4 font-semibold">Thông tin chuyển khoản</h3>
              <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mã đặt vé</span>
                <span className="font-mono font-bold">{booking.booking_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-bold text-purple-400 text-lg">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nội dung CK</span>
                <span className="font-mono text-xs truncate max-w-[200px]">{payment.description}</span>
              </div>
              </div>
            </div>
          </div>)}

          <p className="text-center text-xs text-muted-foreground">
            Đơn đặt vé đang chờ thanh toán. Vé chỉ được xác nhận sau khi hệ thống nhận được kết quả thanh toán thành công.
          </p>
        </div>
      </div>
    );
  }

  // Step 1: Initial page - create booking
  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-12 sm:pb-16 w-full">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pt-3 sm:pt-4">
          <button onClick={handleBack}
            className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Xác nhận đặt vé</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {movie && (
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter">
            <h2 className="font-semibold text-sm sm:text-base mb-4">Thông tin đặt vé</h2>
            <div className="flex gap-3 sm:gap-4">
              <img src={movie.poster} alt={movie.title} className="w-16 sm:w-20 rounded-xl object-cover shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base truncate">{movie.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{cinema?.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Ghế đã chọn: <span className="font-medium text-purple-400">{holdCode ? "Đã giữ" : ""}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-5 animate-enter" style={{ animationDelay: "0.15s" }}>
          <h2 className="font-semibold text-sm sm:text-base mb-4">Thanh toán</h2>
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-purple-500/50 bg-purple-500/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold">Thanh toán qua PayOS</p>
              <p className="text-xs text-muted-foreground">Chuyển khoản / ATM / Visa / Mastercard</p>
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full px-6 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-base sm:text-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25 animate-enter disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ animationDelay: "0.25s" }}>
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý...</> : <>Thanh toán qua PayOS</>}
        </button>
      </div>
    </div>
  );
}
