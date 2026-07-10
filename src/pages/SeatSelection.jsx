import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Check, Loader2 } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { api } from "../lib/api";

export default function SeatSelection() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const time = searchParams.get("time") || "10:00";
  const date = searchParams.get("date") || "";
  const cinemaId = Number(searchParams.get("cinema")) || 1;
  const showtimeId = Number(searchParams.get("showtimeId")) || 0;

  const [movie, setMovie] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/movies/${id}`),
      api.get(`/cinemas/${cinemaId}`),
      api.get(`/seats/${showtimeId}`),
    ]).then(([movieRes, cinemaRes, seatsRes]) => {
      setMovie(movieRes.data);
      setCinema(cinemaRes.data);
      const layout = seatsRes.data || {};
      const seatList = layout.seats || [];
      if (seatList.length > 0) {
        setSeats(seatList.map(s => ({
          id: s.id,
          row_label: s.row,
          seat_number: s.number,
          is_vip: s.isVip ? 1 : 0,
          is_booked: s.isBooked ? 1 : 0,
        })));
      } else {
        setSeats(generateDefaultSeats());
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, cinemaId, showtimeId]);

  function generateDefaultSeats() {
    const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const vipRows = ["E", "F"];
    const seats = [];
    for (const row of rows) {
      for (let i = 1; i <= 12; i++) {
        seats.push({
          row_label: row,
          seat_number: i,
          is_vip: vipRows.includes(row) ? 1 : 0,
          is_booked: 0,
        });
      }
    }
    return seats;
  }

  const toggleSeat = (seatId) => {
    const seat = seats.find(s => `${s.row_label}${s.seat_number}` === seatId);
    if (seat?.is_booked) return;
    setSelectedSeats(prev =>
      prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]
    );
  };

  const selectedSeatObjects = seats.filter(s => selectedSeats.includes(`${s.row_label}${s.seat_number}`));
  const normalCount = selectedSeatObjects.filter(s => !s.is_vip).length;
  const vipCount = selectedSeatObjects.filter(s => s.is_vip).length;
  const total = normalCount * (movie?.ticket_price || 0) + vipCount * (movie?.vip_price || 0);

  const rows = [...new Set(seats.map(s => s.row_label))].sort();

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

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-36 sm:pb-40 w-full">
      <div className="w-full max-w-4xl mx-auto px-5 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pt-3 sm:pt-4">
          <button onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold truncate">{movie.title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {cinema?.name || `Rạp #${cinemaId}`} • {date} • {time}
            </p>
          </div>
        </div>

        <div className="relative mb-6 sm:mb-8">
          <div className="w-full max-w-xs sm:max-w-md mx-auto h-10 sm:h-14 bg-gradient-to-b from-purple-500/30 to-transparent rounded-t-[100%] opacity-60" />
          <div className="w-full max-w-xs sm:max-w-md mx-auto h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
          <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-1.5 tracking-widest uppercase">Màn hình</p>
        </div>

        <div className="overflow-x-auto pb-4 mb-6 sm:mb-8 scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0">
          <div className="min-w-fit mx-auto">
            {rows.map((row) => {
              const rowSeats = seats.filter(s => s.row_label === row).sort((a, b) => a.seat_number - b.seat_number);
              return (
                <div key={row} className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                  <span className="w-5 sm:w-6 text-center text-[10px] sm:text-xs font-bold text-muted-foreground shrink-0">{row}</span>
                  <div className="flex gap-0.5 sm:gap-1 justify-center flex-1">
                    {rowSeats.map((seat, idx) => {
                      const seatId = `${seat.row_label}${seat.seat_number}`;
                      const isSelected = selectedSeats.includes(seatId);
                      const isLeftGap = idx === 2 || idx === 8;
                      return (
                        <div key={seatId} className={`${isLeftGap ? "ml-2 sm:ml-3" : ""}`}>
                          <button onClick={() => toggleSeat(seatId)}
                            disabled={seat.is_booked}
                            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-t-md sm:rounded-t-lg rounded-b-sm sm:rounded-b-md text-[8px] sm:text-xs font-medium transition-all flex items-center justify-center ${
                              seat.is_booked ? "bg-slate-800 text-slate-600 cursor-not-allowed" :
                              seat.is_vip && !isSelected ? "bg-amber-600 text-amber-200 hover:bg-amber-500" :
                              !seat.is_vip && !isSelected ? "bg-slate-600 text-slate-300 hover:bg-slate-500" :
                              "bg-purple-500 text-white scale-110 shadow-lg shadow-purple-500/30"
                            }`}
                            title={`${seatId}${seat.is_vip ? ' (VIP)' : ''}${seat.is_booked ? ' (Đã đặt)' : ''}`}>
                            {seat.is_booked ? "✕" : isSelected ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : seat.seat_number}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <span className="w-5 sm:w-6 text-center text-[10px] sm:text-xs font-bold text-muted-foreground shrink-0">{row}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-[10px] sm:text-xs text-muted-foreground mb-5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-t-sm sm:rounded-t-md rounded-b-xs sm:rounded-b-sm bg-slate-600 border border-slate-500" />
            <span>Trống</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-t-sm sm:rounded-t-md rounded-b-xs sm:rounded-b-sm bg-purple-500" />
            <span>Đang chọn</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-t-sm sm:rounded-t-md rounded-b-xs sm:rounded-b-sm bg-amber-600" />
            <span>VIP</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-t-sm sm:rounded-t-md rounded-b-xs sm:rounded-b-sm bg-slate-800 text-slate-600 flex items-center justify-center text-[7px] sm:text-[8px]">✕</div>
            <span>Đã đặt</span>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center text-[10px] sm:text-xs text-muted-foreground">
          <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>Hàng E, F là ghế VIP. Giá vé VIP cao hơn ghế thường.</span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-40">
        <div className="w-full max-w-4xl mx-auto px-5 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-muted-foreground">Ghế đã chọn</p>
              <p className="font-bold text-sm sm:text-lg truncate">
                {selectedSeats.length > 0 ? selectedSeats.join(", ") : "Chưa chọn ghế"}
              </p>
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                {normalCount > 0 && <span>{normalCount} thường</span>}
                {normalCount > 0 && vipCount > 0 && <span> • </span>}
                {vipCount > 0 && <span>{vipCount} VIP</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground">Tổng cộng</p>
              <p className="text-base sm:text-xl font-bold text-purple-400">{formatCurrency(total)}</p>
            </div>
          </div>
          <button disabled={selectedSeats.length === 0 || holding}
            onClick={async () => {
              setHolding(true);
              try {
                const seatIds = selectedSeats.map(label => {
                  const seat = seats.find(s => `${s.row_label}${s.seat_number}` === label);
                  return seat?.id;
                }).filter(Boolean);
                const res = await api.post('/v1/seat-holds', { showtime_id: showtimeId, seat_ids: seatIds });
                navigate(`/movies/${movie.id}/checkout?holdCode=${res.data.hold_code}&time=${time}&date=${date}&cinema=${cinemaId}&showtimeId=${showtimeId}`);
              } catch (err) {
                alert(err.data?.message || "Không thể giữ ghế, vui lòng thử lại");
              } finally {
                setHolding(false);
              }
            }}
            className={`w-full mt-2.5 sm:mt-3 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-semibold transition-all text-sm sm:text-base ${
              selectedSeats.length > 0
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}>
            {holding ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Đang giữ ghế...</span> :
             selectedSeats.length > 0 ? `Thanh toán ${formatCurrency(total)}` : "Chọn ghế để tiếp tục"}
          </button>
        </div>
      </div>
    </div>
  );
}
