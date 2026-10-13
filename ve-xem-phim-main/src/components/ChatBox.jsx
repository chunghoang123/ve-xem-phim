import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, User, CreditCard, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../lib/utils";
import { getTokenValue } from "../lib/api";

const API_BASE = "/api";
const AI_AVATAR = "/tran-duong-ai.png";

function authHeaders() {
  const token = getTokenValue();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [aiProvider, setAiProvider] = useState(null);
  const [selectedSeatCodes, setSelectedSeatCodes] = useState([]);
  const [concessionQuantities, setConcessionQuantities] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const paymentCheckInFlight = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (messages.length === 0) {
        const greeting = {
          id: Date.now(),
          role: "bot",
          text: `Chào bạn 👋 Mình là **Trần Dương AI**.

Bạn cứ trò chuyện tự nhiên với mình nhé — có thể hỏi nội dung phim, xin gợi ý theo tâm trạng, tìm rạp hoặc nói luôn nhu cầu đặt vé của bạn.`,
          quickReplies: ["Gợi ý phim cho mình ✨", "Mình muốn đặt vé 🎫"],
        };
        setMessages([greeting]);
      }
    }
  }, [isOpen, messages.length]);

  const sendToAI = useCallback(async (text, { silent = false, concessions = [], action = null } = {}) => {
    if (silent && paymentCheckInFlight.current) return null;
    if (silent) paymentCheckInFlight.current = true;
    if (!silent) setIsTyping(true);
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ conversationId, message: text, concessions, action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Lỗi");

      if (!conversationId) setConversationId(data.conversationId);
      if (data.ai?.used) setAiProvider(data.ai.provider);
      if (data.currentStep === "SELECT_SEAT" && data.data?.seats) {
        setSelectedSeatCodes([]);
      }
      if (data.currentStep === "REVIEW_BILL" && data.data?.concessionProducts) {
        setConcessionQuantities({});
      }

      const botMsg = {
        id: Date.now() + 1,
        role: "bot",
        text: data.message,
        quickReplies: (data.suggestedActions || []).map((a) => a.label),
        suggestedActions: data.suggestedActions || [],
        data: data.data,
        currentStep: data.currentStep,
      };
      if (!silent || data.currentStep === "COMPLETED") {
        setMessages((prev) => [...prev, botMsg]);
      }
      setPaymentData((previous) =>
        data.currentStep === "PAYMENT_PENDING"
          ? { ...previous, ...(data.data || {}) }
          : null
      );
      return data;
    } catch (err) {
      if (!silent) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "bot",
            text: `❌ Lỗi: ${err.message}. Vui lòng thử lại!`,
            quickReplies: ["Phim đang chiếu 🎬", "Hỗ trợ"],
            suggestedActions: [],
          },
        ]);
      }
      return null;
    } finally {
      if (!silent) setIsTyping(false);
      paymentCheckInFlight.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isOpen || !paymentData?.paymentCode || paymentData.paymentStatus === "PAID") return undefined;
    const intervalId = window.setInterval(() => {
      sendToAI("Kiểm tra thanh toán", { silent: true });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [isOpen, paymentData?.paymentCode, paymentData?.paymentStatus, sendToAI]);

  const handleSend = useCallback(
    async (text) => {
      const userMsg = text || input.trim();
      if (!userMsg) return;

      const userMessage = { id: Date.now(), role: "user", text: userMsg };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      if (userMsg.startsWith("Phim đang chiếu") || userMsg === "Phim đang chiếu 🎬") {
        await sendToAI("Có phim gì đang chiếu?");
        return;
      }

      if (userMsg.startsWith("Kiểm tra") || userMsg === "Kiểm tra thanh toán 🔄") {
        const lastPayment = paymentData;
        if (lastPayment?.paymentCode) {
          await sendToAI("Kiểm tra thanh toán");
          return;
        }
      }

      if (paymentData?.checkoutUrl && userMsg.startsWith("Thanh toán")) {
        window.open(paymentData.checkoutUrl, "_blank");
        return;
      }

      await sendToAI(userMsg);
    },
    [input, sendToAI, paymentData]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply) => {
    if (paymentData?.checkoutUrl && reply === "Mở PayOS 💳") {
      window.open(paymentData.checkoutUrl, "_blank");
      return;
    }
    if (paymentData && reply === "Kiểm tra thanh toán 🔄") {
      sendToAI("Kiểm tra thanh toán");
      return;
    }
    handleSend(reply);
  };

  const formatText = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*|~~.*?~~)/g).filter(Boolean);
      return (
        <span key={i}>
          {parts.map((part, partIndex) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={partIndex} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith("~~") && part.endsWith("~~")) {
              return <span key={partIndex} className="line-through text-muted-foreground">{part.slice(2, -2)}</span>;
            }
            return <span key={partIndex}>{part}</span>;
          })}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  const renderMovies = (movies) => {
    if (!movies?.length) return null;
    return (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 snap-x">
        {movies.slice(0, 6).map((movie) => (
          <button
            key={movie.id}
            type="button"
            onClick={() => handleSend(movie.title)}
            className="w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-card text-left hover:border-purple-500/50 transition-colors snap-start"
          >
            {movie.poster ? (
              <img src={movie.poster} alt={movie.title} className="h-40 w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-40 w-full bg-purple-500/10 flex items-center justify-center text-3xl">🎬</div>
            )}
            <div className="p-2">
              <p className="text-xs font-semibold text-foreground line-clamp-2">{movie.title}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {movie.rating ? `⭐ ${movie.rating}` : movie.genre || `${movie.duration || "--"} phút`}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const toggleSeat = (code) => {
    setSelectedSeatCodes((current) =>
      current.includes(code)
        ? current.filter((seatCode) => seatCode !== code)
        : [...current, code]
    );
  };

  const renderSeatMap = (data, interactive = false) => {
    if (!data?.seats?.length) return null;

    const rows = data.seats.reduce((grouped, seat) => {
      const row = seat.code.match(/^[A-Z]+/)?.[0] || "";
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
      return grouped;
    }, {});
    const sortedRows = Object.entries(rows)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([row, seats]) => [
        row,
        [...seats].sort((left, right) =>
          Number(left.code.match(/\d+/)?.[0]) - Number(right.code.match(/\d+/)?.[0])
        ),
      ]);

    return (
      <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
        <div className="mx-auto mb-4 w-4/5">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-500/30 via-purple-400 to-pink-500/30 shadow-[0_3px_10px_rgba(168,85,247,0.35)]" />
          <p className="mt-1 text-center text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Màn hình</p>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="mx-auto w-max space-y-1.5">
            {sortedRows.map(([row, seats]) => (
              <div key={row} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-center text-[10px] font-bold text-muted-foreground">{row}</span>
                <div className="flex gap-1">
                  {seats.map((seat) => {
                    const selected = selectedSeatCodes.includes(seat.code);
                    return (
                      <button
                        key={seat.id || seat.code}
                        type="button"
                        disabled={seat.isBooked || !interactive}
                        onClick={() => toggleSeat(seat.code)}
                        title={seat.isBooked ? `${seat.code} đã đặt` : `${seat.code} - ${seat.type}`}
                        aria-label={seat.isBooked ? `Ghế ${seat.code} đã đặt` : `Ghế ${seat.code}${selected ? " đã chọn" : " còn trống"}`}
                        className={cn(
                          "h-7 w-7 rounded-t-lg rounded-b-sm border text-[8px] font-bold transition-all",
                          seat.isBooked && "cursor-not-allowed border-muted bg-muted text-muted-foreground/40 line-through",
                          !seat.isBooked && !selected && "border-purple-500/40 bg-purple-500/10 text-purple-300",
                          !seat.isBooked && interactive && !selected && "hover:-translate-y-0.5 hover:bg-purple-500/25",
                          selected && "-translate-y-0.5 border-emerald-400 bg-emerald-500 text-white shadow-md shadow-emerald-500/20",
                          !interactive && !seat.isBooked && "cursor-default"
                        )}
                      >
                        {seat.code.replace(row, "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-purple-500/40 bg-purple-500/10" />Trống</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Đang chọn</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-muted" />Đã đặt</span>
          <span>⭐ Ghế VIP</span>
        </div>

        {interactive && (
          <button
            type="button"
            disabled={selectedSeatCodes.length === 0}
            onClick={() => handleSend(selectedSeatCodes.join(", "))}
            className={cn(
              "mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold transition-all",
              selectedSeatCodes.length > 0
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            {selectedSeatCodes.length > 0
              ? `Tiếp tục với ${selectedSeatCodes.length} ghế (${selectedSeatCodes.join(", ")})`
              : "Chọn ghế trên sơ đồ"}
          </button>
        )}
      </div>
    );
  };

  const renderPaymentData = (data) => {
    if (!data) return null;
    return (
      <div className="mt-3 space-y-2">
        {data.qrCode && (
          <div className="rounded-xl bg-white p-3 flex justify-center">
            <QRCodeSVG value={data.qrCode} size={184} level="M" />
          </div>
        )}
        <div className="text-xs text-muted-foreground space-y-1">
          {data.amount && (
            <p>💰 Số tiền: <strong className="text-foreground">{(data.amount || data.totalAmount || 0).toLocaleString("vi-VN")}đ</strong></p>
          )}
          {data.booking_code && <p>📄 Mã đơn: {data.booking_code}</p>}
          {data.seatCodes?.length > 0 && <p>🎟️ Ghế: {data.seatCodes.join(", ")}</p>}
          {data.accountName && <p>👤 Người nhận: <strong className="text-foreground">{data.accountName}</strong></p>}
          {data.accountNumber && <p>🏦 Số tài khoản: <strong className="text-foreground">{data.accountNumber}</strong></p>}
          {data.expiresAt && <p>⏳ Thanh toán trước: {new Date(data.expiresAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>}
          {data.qrCode && <p className="text-center text-emerald-400 font-medium pt-1">Quét QR bằng ứng dụng ngân hàng</p>}
          {data.checkoutUrl && (
            <a
              href={data.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full text-center px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5 inline mr-1" />
              Mở PayOS thanh toán 💳
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderTicketQRCodes = (data) => {
    const tickets = data?.tickets?.length
      ? data.tickets
      : data?.ticketCode
        ? [{ code: data.ticketCode, qrData: data.ticketCode, seatCode: "" }]
        : [];
    if (tickets.length === 0) return null;

    return (
      <div className="mt-3 space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.code} className="rounded-xl border border-emerald-500/20 bg-background/60 p-3 text-center">
            <div className="mx-auto w-fit rounded-xl bg-white p-2.5">
              <QRCodeSVG
                value={ticket.qrData || ticket.code}
                size={156}
                level="M"
                includeMargin={false}
                title={`QR vé ${ticket.code}`}
              />
            </div>
            {ticket.seatCode && <p className="mt-2 text-xs font-bold text-emerald-400">Ghế {ticket.seatCode}</p>}
            <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{ticket.code}</p>
          </div>
        ))}
        <p className="text-center text-[10px] text-muted-foreground">Đưa mã QR này cho nhân viên soát vé tại rạp.</p>
      </div>
    );
  };

  const updateConcession = (productId, change, stock = 10) => {
    setConcessionQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(10, stock, (current[productId] || 0) + change)),
    }));
  };

  const renderBillActions = (data, interactive = false) => {
    if (!data) return null;
    const products = data.concessionProducts || [];
    const concessionTotal = products.reduce(
      (sum, product) => sum + Number(product.price || 0) * (concessionQuantities[product.id] || 0),
      0
    );
    const grandTotal = Number(data.total || 0) + concessionTotal;
    const selectedConcessions = Object.entries(concessionQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    return (
      <div className="mt-3 space-y-3 border-t border-border pt-3">
        {products.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-foreground">🍿 Thêm bỏng & nước</p>
            <div className="space-y-2">
              {products.map((product) => {
                const quantity = concessionQuantities[product.id] || 0;
                return (
                  <div key={product.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg">
                      {product.id.includes("drink") ? "🥤" : product.id.includes("combo") ? "🍿🥤" : "🍿"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-foreground">{product.name}</p>
                      <p className="text-[10px] text-amber-400">{Number(product.price).toLocaleString("vi-VN")}đ</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!interactive || quantity === 0}
                        onClick={() => updateConcession(product.id, -1, product.stock)}
                        aria-label={`Giảm ${product.name}`}
                        className="h-6 w-6 rounded-md border border-border text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      >−</button>
                      <span className="w-5 text-center text-[11px] font-bold">{quantity}</span>
                      <button
                        type="button"
                        disabled={!interactive || quantity >= Math.min(10, product.stock)}
                        onClick={() => updateConcession(product.id, 1, product.stock)}
                        aria-label={`Thêm ${product.name}`}
                        className="h-6 w-6 rounded-md border border-purple-500/40 bg-purple-500/10 text-xs text-purple-300 disabled:cursor-not-allowed disabled:opacity-35"
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-background/60 p-2.5 text-xs">
          <div className="flex justify-between text-muted-foreground"><span>Vé + phí dịch vụ</span><span>{Number(data.total || 0).toLocaleString("vi-VN")}đ</span></div>
          {concessionTotal > 0 && <div className="mt-1 flex justify-between text-muted-foreground"><span>Bỏng & nước</span><span>{concessionTotal.toLocaleString("vi-VN")}đ</span></div>}
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-foreground"><span>Tổng thanh toán</span><span className="text-emerald-400">{grandTotal.toLocaleString("vi-VN")}đ</span></div>
        </div>

        {interactive && (
          <button
            type="button"
            onClick={() => sendToAI("Thanh toán ngay", { concessions: selectedConcessions, action: "CONFIRM_BOOKING" })}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-2.5 text-xs font-bold text-white transition-all hover:from-emerald-600 hover:to-green-600"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Thanh toán ngay · {grandTotal.toLocaleString("vi-VN")}đ
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center group",
          isOpen
            ? "bg-card border border-border rotate-0"
            : "bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
        ) : (
          <img
            src={AI_AVATAR}
            alt="Trần Dương AI"
            className="w-full h-full rounded-full object-cover object-center ring-2 ring-white/70"
          />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[400px] max-h-[calc(100vh-140px)] sm:max-h-[600px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 shrink-0">
            <img
              src={AI_AVATAR}
              alt="Trần Dương AI"
              className="w-10 h-10 rounded-full object-cover object-center ring-2 ring-white/50 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm sm:text-base">Trần Dương AI</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-[10px] sm:text-xs">
                  {aiProvider === "NVIDIA NIM" ? "NVIDIA NIM đang hoạt động" : "Đang hoạt động"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
            {messages.map((msg) => {
              const latestSeatMapId = [...messages].reverse().find(
                (message) => message.role === "bot" && message.currentStep === "SELECT_SEAT" && message.data?.seats
              )?.id;
              const seatMapIsInteractive = msg.id === latestSeatMapId && !isTyping;
              const latestBillId = [...messages].reverse().find(
                (message) => message.role === "bot" && message.currentStep === "REVIEW_BILL" && message.data?.holdCode
              )?.id;
              const billIsInteractive = msg.id === latestBillId && !isTyping;
              return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 sm:gap-2.5 animate-enter",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "bot" && (
                  <img
                    src={AI_AVATAR}
                    alt="Trần Dương AI"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover object-center ring-1 ring-purple-400/50 shrink-0 mt-0.5"
                  />
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  <div>{formatText(msg.text)}</div>
                  {msg.role === "bot" && msg.data?.movies && renderMovies(msg.data.movies)}
                  {msg.role === "bot" && msg.currentStep === "SELECT_SEAT" && msg.data?.seats && renderSeatMap(msg.data, seatMapIsInteractive)}
                  {msg.role === "bot" && msg.currentStep === "REVIEW_BILL" && msg.data?.holdCode && renderBillActions(msg.data, billIsInteractive)}
                  {msg.role === "bot" && msg.currentStep === "PAYMENT_PENDING" && msg.data && renderPaymentData(msg.data)}

                  {msg.role === "bot" && msg.currentStep === "COMPLETED" && msg.data?.ticketCode && (
                    <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-emerald-400 font-bold text-xs">🎉 ĐẶT VÉ THÀNH CÔNG!</p>
                      <p className="text-xs text-muted-foreground mt-1">Mã vé: <strong className="text-foreground">{msg.data.ticketCode}</strong></p>
                      {renderTicketQRCodes(msg.data)}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
              );
            })}

            {isTyping && (
              <div className="flex gap-2.5 animate-enter">
                <img
                  src={AI_AVATAR}
                  alt="Trần Dương AI đang trả lời"
                  className="w-8 h-8 rounded-full object-cover object-center ring-1 ring-purple-400/50 shrink-0"
                />
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {!isTyping && messages.length > 0 && (() => {
              const lastBot = [...messages].reverse().find(
                (m) => m.role === "bot" && m.quickReplies?.length > 0
              );
              if (!lastBot || lastBot.id !== messages[messages.length - 1]?.id) return null;
              const steps = lastBot.currentStep;
              const isPayment = steps === "PAYMENT_PENDING" && paymentData;
              const isCompleted = steps === "COMPLETED";

              return (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 animate-enter">
                  {isPayment && paymentData?.checkoutUrl && (
                    <button
                      onClick={() => window.open(paymentData.checkoutUrl, "_blank")}
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold hover:from-emerald-600 hover:to-green-600 transition-all flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Mở PayOS 💳
                    </button>
                  )}
                  {isPayment && (
                    <button
                      onClick={() => sendToAI("Kiểm tra thanh toán")}
                      className="px-3 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Kiểm tra 🔄
                    </button>
                  )}
                  {!isCompleted && lastBot.quickReplies.map((reply, idx) => {
                    if (reply.includes("✅") || reply.includes("📅") || reply.includes("📍")) return null;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] sm:text-xs font-medium hover:bg-purple-500/20 transition-colors max-w-full truncate"
                      >
                        {reply}
                      </button>
                    );
                  })}
                  {isCompleted && (
                    <button
                      onClick={() => { setMessages([]); setConversationId(null); setPaymentData(null); setIsOpen(false); }}
                      className="px-3 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all"
                    >
                      Đặt vé mới 🎬
                    </button>
                  )}
                </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 sm:p-4 border-t border-border shrink-0">
            <div className="flex gap-2 sm:gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={paymentData ? "Kiểm tra thanh toán..." : "Nhập tin nhắn..."}
                className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-muted border border-border text-foreground text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all min-w-0"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={cn(
                  "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  input.trim()
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
