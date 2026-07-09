import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Star, Clock, Calendar, Play, MapPin, Navigation, ChevronDown } from "lucide-react";
import { formatCurrency, formatDate, handleImgError } from "../lib/utils";
import { api } from "../lib/api";
import { useLocation } from "../lib/location";
import TrailerModal from "../components/TrailerModal";

function getDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Hôm nay (${fmt})`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ngày mai (${fmt})`;
  return fmt;
}

export default function MovieDetail() {
  const { id } = useParams();
  const { selectedCity, selectedProvince, userCoords, requestGeolocation, provinces, regions, provincesByRegion, setSelectedCity, setSelectedProvince } = useLocation();
  const [movie, setMovie] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvPicker, setShowProvPicker] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedProvince) params.set("province_id", selectedProvince);
    if (selectedCity) params.set("city", selectedCity);
    const qs = params.toString();
    api.get(`/movies/${id}/showtimes${qs ? "?" + qs : ""}`)
      .then(res => {
        setMovie({ id: res.data.movieId, title: res.data.movieName, ...res.data });
        setCities(res.data.cities || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, selectedProvince, selectedCity]);

  const selectedProvinceName = provinces.find(p => p.id === selectedProvince)?.name || "Chọn tỉnh/thành";

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
    <>
    <div className="min-h-screen w-full">
      <div className="relative h-48 sm:h-64 md:h-80 lg:h-[28rem] overflow-hidden">
        <img src={movie.backdrop || movie.poster || ""} alt="" onError={handleImgError} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
        <Link to="/movies"
          className="absolute top-16 sm:top-20 left-4 sm:left-6 lg:left-8 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors text-xs sm:text-sm font-medium z-10">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Quay lại</span>
        </Link>
      </div>

      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 md:-mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="w-40 sm:w-48 md:w-52 lg:w-56 shrink-0 mx-auto md:mx-0 animate-enter">
            <img src={movie.poster || ""} alt={movie.title} onError={handleImgError} className="w-full rounded-2xl shadow-2xl border border-border" />
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left animate-enter" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">{movie.title}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 mb-4 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> 8.5
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {movie.duration} phút
              </span>
              <span className="text-border">•</span>
              <span className="px-2.5 py-1 rounded-lg bg-muted text-xs font-semibold">{movie.rating}</span>
              <span className="text-border">•</span>
              <span>{movie.genre}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 text-sm">
              <div><span className="text-muted-foreground">Đạo diễn: </span><span>{movie.director}</span></div>
              <div><span className="text-muted-foreground">Diễn viên: </span><span>{movie.cast}</span></div>
              <div><span className="text-muted-foreground">Khởi chiếu: </span><span>{formatDate(movie.release_date)}</span></div>
              <div><span className="text-muted-foreground">Giá vé: </span><span className="text-purple-400 font-semibold">Từ {formatCurrency(movie.ticket_price)}</span></div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">{movie.description}</p>
            {movie.trailer_url && (
              <button onClick={() => setShowTrailer(true)}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-medium cursor-pointer">
                <Play className="w-4 h-4" />
                Xem trailer
              </button>
            )}
          </div>
        </div>

        <div className="mt-10 sm:mt-12 mb-8 animate-enter" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-xl sm:text-2xl font-bold mb-6">Chọn suất chiếu</h2>

          <div className="mb-6">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Chọn khu vực
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <button onClick={() => setShowProvPicker(!showProvPicker)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-purple-500/30 text-sm font-medium transition-colors">
                  {selectedProvinceName} <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showProvPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[220px] max-h-80 overflow-y-auto">
                    {regions.map(region => (
                      <div key={region}>
                        <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">{region}</div>
                        {provincesByRegion(region).map(p => (
                          <button key={p.id} onClick={() => { setSelectedProvince(p.id); setSelectedCity(p.name); setShowProvPicker(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${selectedProvince === p.id ? "text-purple-400 font-semibold" : ""}`}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!userCoords && (
                <button onClick={requestGeolocation}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors">
                  <Navigation className="w-3.5 h-3.5" /> Vị trí của tôi
                </button>
              )}
            </div>
          </div>

          {!cities || cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có lịch chiếu nào trong khu vực này</p>
          ) : (
            <div className="space-y-8">
              {(cities || []).map(city => (
                <div key={city.city}>
                  <h3 className="text-lg font-bold text-purple-400 mb-4">{city.city}</h3>
                  {(city.districts || []).map(district => (
                    <div key={district.district} className="mb-5">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{district.district}</h4>
                      <div className="space-y-4">
                        {(district.cinemas || []).map(cinema => {
                          const dates = Array.isArray(cinema.dates) ? cinema.dates : [];
                          return (
                            <div key={cinema.cinemaId} className="bg-card border border-border rounded-xl p-4">
                              <h5 className="font-bold text-sm sm:text-base">{cinema.cinemaName}</h5>
                              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Địa chỉ: {cinema.address}</p>
                              <div className="space-y-2">
                                {dates.map(({ date, showtimes }) => {
                                  const stList = Array.isArray(showtimes) ? showtimes : [];
                                  return (
                                    <div key={date} className="flex items-start gap-2">
                                      <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                                      <div className="min-w-0 flex-1">
                                        <span className="text-xs font-semibold block mb-1">{getDateLabel(date)}</span>
                                        <div className="flex gap-2 flex-wrap">
                                          {stList.map(st => (
                                            <Link key={st.showtimeId}
                                              to={`/movies/${movie.id}/seats?time=${st.time}&date=${date}&cinema=${cinema.cinemaId}&showtimeId=${st.showtimeId}`}
                                              className="px-3 py-1.5 rounded-lg bg-muted border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors text-xs font-semibold whitespace-nowrap">
                                              {st.time}
                                              <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{formatCurrency(st.price)}</span>
                                              {st.format && <span className="ml-1 text-[10px] text-blue-400">{st.format}</span>}
                                              {st.language && <span className="ml-1 text-[10px] text-amber-400">{st.language}</span>}
                                            </Link>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-8 sm:h-16" />
    </div>
      {showTrailer && <TrailerModal url={movie.trailer_url} onClose={() => setShowTrailer(false)} />}
    </>
  );
}
