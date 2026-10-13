import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PartyPopper, AlertCircle, Loader2, Clock } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { api } from "../lib/api";

const TERMINAL_STATUSES = new Set(["PAID", "CANCELLED", "EXPIRED", "FAILED"]);

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get("orderCode");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderCode) {
      setError("Thiếu mã giao dịch từ PayOS.");
      setLoading(false);
      return undefined;
    }

    let stopped = false;
    const check = async () => {
      try {
        const res = await api.get(`/v1/payments/order/${encodeURIComponent(orderCode)}/status`);
        if (stopped) return;
        setPaymentInfo(res.data);
        setError("");
        if (TERMINAL_STATUSES.has(res.data.payment_status)) stopped = true;
      } catch (err) {
        if (!stopped) setError(err.data?.message || "Chưa thể xác nhận giao dịch. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    check();
    const interval = setInterval(() => {
      if (!stopped) check();
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [orderCode]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  const isPaid = paymentInfo?.payment_status === "PAID" && paymentInfo?.booking_status === "CONFIRMED";
  const isFailed = ["CANCELLED", "EXPIRED", "FAILED"].includes(paymentInfo?.payment_status);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 w-full">
      <div className="max-w-sm w-full text-center animate-scale">
        {isPaid ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
              <PartyPopper className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Đặt vé thành công!</h1>
            <p className="text-muted-foreground text-sm mb-8">Thanh toán đã được xác nhận và vé đã được phát hành.</p>
          </>
        ) : isFailed ? (
          <>
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-5" />
            <h1 className="text-2xl font-bold mb-2">Giao dịch không thành công</h1>
            <p className="text-muted-foreground text-sm mb-8">Giao dịch đã hủy, thất bại hoặc hết hạn. Bạn có thể chọn lại ghế để đặt vé mới.</p>
          </>
        ) : (
          <>
            <Clock className="w-16 h-16 text-amber-400 mx-auto mb-5" />
            <h1 className="text-2xl font-bold mb-2">Đang xác nhận thanh toán</h1>
            <p className="text-muted-foreground text-sm mb-8">Hệ thống đang đối soát với PayOS. Trang sẽ tự cập nhật.</p>
          </>
        )}

        {paymentInfo && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Mã đơn</span><span className="font-mono font-bold">{paymentInfo.booking_code || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mã giao dịch</span><span className="font-mono">{orderCode}</span></div>
            {paymentInfo.amount != null && <div className="flex justify-between"><span className="text-muted-foreground">Số tiền</span><span className="font-bold text-green-400">{formatCurrency(paymentInfo.amount)}</span></div>}
          </div>
        )}

        {error && <div className="p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">{error}</div>}

        <div className="flex gap-3">
          <Link to="/" className="flex-1 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-center">Về trang chủ</Link>
          <Link to="/profile" className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold text-center">Xem vé của tôi</Link>
        </div>
      </div>
    </div>
  );
}
