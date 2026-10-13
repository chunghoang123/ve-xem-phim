import { MapPin, Search, X, ChevronDown, Navigation, Navigation2, LocateFixed, Calendar } from "lucide-react";
import { formatCurrency, handleImgError } from "../lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useLocation } from "../lib/location-context";

const BRANDS = ["CGV", "Lotte", "BHD", "Beta", "Galaxy"];
const RADIUS_OPTIONS = [3, 5, 7, 10];

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

export default function Showtimes() {
  const { provinces, regions, provincesByRegion, selectedProvince, setSelectedProvince, selectedCity, setSelectedCity, userCoords, setUserCoords } = useLocation();
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationSearch, setLocationSearch] = useState("");
  const [error, setError] = useState("");
  const [showProvPicker, setShowProvPicker] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedRadius, setSelectedRadius] = useState(null);
  const [nearbyMap, setNearbyMap] = useState({});
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotification, setGeoNotification] = useState("");
  const [expandedCinemas, setExpandedCinemas] = useState(() => new Set());

  const toggleCinema = (cinemaId) => {
    setExpandedCinemas(current => {
      const next = new Set(current);
      if (next.has(cinemaId)) next.delete(cinemaId);
      else next.add(cinemaId);
      return next;
    });
  };

  const selectedProvinceName = provinces.find(p => p.id === selectedProvince)?.name || "Chọn tỉnh/thành";

  const fetchShowtimes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '5000' });
      if (selectedProvince) params.set('province_id', selectedProvince);
      if (selectedCity) params.set('city', selectedCity);
      if (selectedBrand !== 'all') params.set('brand', selectedBrand);
      const res = await api.get(`/showtimes?${params}`);
      setShowtimes(res.data || []);
    } catch (err) {
      setError(err.data?.message || "Lỗi tải dữ liệu");
      setShowtimes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProvince, selectedCity, selectedBrand]);

  const fetchNearby = useCallback(async () => {
    if (!userCoords) return;
    setGeoLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('lat', userCoords.lat);
      params.set('lng', userCoords.lng);
      params.set('limit', '50');
      if (selectedRadius) params.set('radius', selectedRadius);
      if (selectedBrand !== 'all') params.set('brand', selectedBrand);
      if (selectedCity) params.set('city', selectedCity);
      const res = await api.get(`/cinemas/nearby?${params}`);
      const list = res.data || [];
      const map = {};
      list.forEach(c => { map[c.id] = { distanceKm: c.distanceKm }; });
      setNearbyMap(map);
    } catch {
      setNearbyMap({});
    } finally {
      setGeoLoading(false);
    }
  }, [userCoords, selectedRadius, selectedBrand, selectedCity]);

  useEffect(() => {
    fetchShowtimes();
    const refreshId = setInterval(fetchShowtimes, 60000);
    return () => clearInterval(refreshId);
  }, [fetchShowtimes]);

  useEffect(() => {
    if (userCoords) {
      fetchNearby();
    } else {
      setNearbyMap({});
    }
  }, [userCoords, fetchNearby]);

  const handleRequestGeo = () => {
    if (!navigator.geolocation) {
      setGeoNotification("Trình duyệt không hỗ trợ định vị");
      setTimeout(() => setGeoNotification(""), 4000);
      return;
    }
    setGeoLoading(true);
    setGeoNotification("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSelectedRadius(5);
        setGeoLoading(false);
      },
      (err) => {
        const msg = err.code === 1
          ? "Bạn đã từ chối quyền truy cập vị trí. Vui lòng bật quyền trong trình duyệt."
          : "Không thể lấy vị trí hiện tại.";
        setGeoNotification(msg);
        setGeoLoading(false);
        setTimeout(() => setGeoNotification(""), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClearGeo = () => {
    setUserCoords(null);
    setSelectedRadius(null);
    setNearbyMap({});
  };

  const isGeoFiltered = !!(userCoords && selectedRadius);
  const activeCinemaIds = useMemo(() => isGeoFiltered
    ? new Set(Object.keys(nearbyMap).map(Number))
    : null, [isGeoFiltered, nearbyMap]);

  const groupedData = useMemo(() => {
    const citiesMap = {};
    showtimes.forEach(st => {
      const cityKey = st.city || "Khác";
      if (!citiesMap[cityKey]) citiesMap[cityKey] = { city: cityKey, districts: {} };

      const distKey = st.district || "Khác";
      if (!citiesMap[cityKey].districts[distKey]) {
        citiesMap[cityKey].districts[distKey] = { district: distKey, cinemas: {} };
      }

      const cinemaKey = st.cinema_id;
      if (!citiesMap[cityKey].districts[distKey].cinemas[cinemaKey]) {
        citiesMap[cityKey].districts[distKey].cinemas[cinemaKey] = {
          cinemaId: st.cinema_id,
          cinemaName: st.cinema_name,
          brand: st.brand,
          address: st.cinema_address,
          distanceKm: nearbyMap[st.cinema_id]?.distanceKm || null,
          movies: {},
        };
      }

      const movieKey = st.movie_id;
      const movies = citiesMap[cityKey].districts[distKey].cinemas[cinemaKey].movies;
      if (!movies[movieKey]) movies[movieKey] = { dates: {} };

      const dateKey = st.date;
      if (!movies[movieKey].dates[dateKey]) movies[movieKey].dates[dateKey] = [];

      movies[movieKey].dates[dateKey].push({
        showtimeId: st.id,
        time: st.time,
        format: st.format,
        language: st.language,
        price: st.price || st.ticket_price,
        movieTitle: st.movie_title,
        moviePoster: st.movie_poster,
        movieId: st.movie_id,
      });
    });

    return Object.values(citiesMap)
      .sort((a, b) => a.city.localeCompare(b.city, 'vi'))
      .filter(c => {
        if (activeCinemaIds) {
          const hasActive = Object.values(c.districts).some(d =>
            Object.values(d.cinemas).some(cin => activeCinemaIds.has(cin.cinemaId))
          );
          if (!hasActive) return false;
        }
        return true;
      })
      .map(city => ({
        ...city,
        districts: Object.values(city.districts)
          .sort((a, b) => a.district.localeCompare(b.district, 'vi'))
          .map(dist => ({
            ...dist,
            cinemas: Object.values(dist.cinemas)
              .sort((a, b) => a.cinemaName.localeCompare(b.cinemaName, 'vi'))
              .filter(cin => {
                if (locationSearch && !cin.cinemaName.toLowerCase().includes(locationSearch.toLowerCase()) && !cin.address.toLowerCase().includes(locationSearch.toLowerCase())) return false;
                if (activeCinemaIds && !activeCinemaIds.has(cin.cinemaId)) return false;
                return true;
              })
              .map(cin => ({
                ...cin,
                movies: Object.entries(cin.movies).reduce((acc, [movieId, movieData]) => {
                  const datesEntries = movieData.dates && typeof movieData.dates === 'object' && !Array.isArray(movieData.dates)
                    ? Object.entries(movieData.dates)
                    : Array.isArray(movieData.dates)
                      ? movieData.dates.map(d => [d.date || '', d.showtimes || []])
                      : [];
                  const sortedDates = datesEntries
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, showtimes]) => ({
                      date,
                      showtimes: (showtimes || []).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
                    }));
                  const firstSt = sortedDates[0]?.showtimes?.[0];
                  acc.push({
                    movieId: Number(movieId),
                    movieTitle: firstSt?.movieTitle || `Phim #${movieId}`,
                    moviePoster: firstSt?.moviePoster || '',
                    dates: sortedDates,
                  });
                  return acc;
                }, []),
              })),
          })),
      }));
  }, [showtimes, nearbyMap, activeCinemaIds, locationSearch]);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 w-full">
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="mb-7 sm:mb-9">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1.5 sm:mb-2">Lịch chiếu</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Xem lịch chiếu tại các rạp trên toàn quốc</p>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="relative">
            <button onClick={() => setShowProvPicker(!showProvPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
              {selectedProvinceName} <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showProvPicker && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[200px] max-h-80 overflow-y-auto">
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

          {!userCoords ? (
            <button onClick={handleRequestGeo} disabled={geoLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors disabled:opacity-50">
              <Navigation className="w-3.5 h-3.5" /> {geoLoading ? "Đang định vị..." : "Vị trí của tôi"}
            </button>
          ) : (
            <button onClick={handleClearGeo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm font-medium transition-colors">
              <LocateFixed className="w-3.5 h-3.5" /> Đã định vị
            </button>
          )}
        </div>

        {geoNotification && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
            {geoNotification}
          </div>
        )}

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thương hiệu</span>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setSelectedBrand("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                selectedBrand === "all" ? "bg-purple-500/20 border-purple-500/50 text-purple-400" : "bg-card border-border text-muted-foreground hover:border-purple-500/30"
              }`}>
              Tất cả
            </button>
            {BRANDS.map(brand => (
              <button key={brand} onClick={() => setSelectedBrand(selectedBrand === brand ? "all" : brand)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  selectedBrand === brand ? "bg-purple-500/20 border-purple-500/50 text-purple-400" : "bg-card border-border text-muted-foreground hover:border-purple-500/30"
                }`}>
                {brand}
              </button>
            ))}
          </div>
        </div>

        {userCoords && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Navigation2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Khoảng cách</span>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setSelectedRadius(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  selectedRadius === null ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-card border-border text-muted-foreground hover:border-green-500/30"
                }`}>
                Tất cả
              </button>
              {RADIUS_OPTIONS.map(km => (
                <button key={km} onClick={() => setSelectedRadius(selectedRadius === km ? null : km)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                    selectedRadius === km ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-card border-border text-muted-foreground hover:border-green-500/30"
                  }`}>
                  Trong {km} km
                </button>
              ))}
              {geoLoading && <span className="text-xs text-muted-foreground self-center">Đang tính...</span>}
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Tìm rạp... (gõ tên rạp hoặc địa chỉ)" value={locationSearch}
            onChange={e => setLocationSearch(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl py-2.5 pl-9 pr-9 text-sm outline-none focus:border-purple-500/50 transition-colors" />
          {locationSearch && (
            <button onClick={() => setLocationSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center py-20 text-muted-foreground">Đang tải...</p>
        ) : groupedData.length === 0 ? (
          <p className="text-center py-20 text-muted-foreground">Hiện chưa có lịch chiếu nào</p>
        ) : (
          <div className="space-y-8">
            {(groupedData || []).map(city => (
              <div key={city.city}>
                <h2 className="text-lg font-bold text-purple-400 mb-4">{city.city}</h2>
                {(city.districts || []).map(district => (
                  <div key={district.district} className="mb-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{district.district}</h3>
                    <div className="space-y-4">
                      {(district.cinemas || []).map(cinema => {
                        const isExpanded = expandedCinemas.has(cinema.cinemaId);
                        const movieCount = (cinema.movies || []).length;
                        const showtimeCount = (cinema.movies || []).reduce(
                          (total, movie) => total + (movie.dates || []).reduce(
                            (dateTotal, date) => dateTotal + (date.showtimes || []).length,
                            0
                          ),
                          0
                        );
                        return (
                        <div key={cinema.cinemaId} className="bg-card border border-border rounded-xl overflow-hidden">
                          <button type="button" onClick={() => toggleCinema(cinema.cinemaId)}
                            aria-expanded={isExpanded}
                            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm sm:text-base">{cinema.cinemaName}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">Địa chỉ: {cinema.address}</p>
                              <p className="text-[11px] text-purple-400 mt-1 font-medium">
                                {movieCount} phim · {showtimeCount} suất chiếu
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {cinema.distanceKm && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium flex items-center gap-1">
                                  <Navigation2 className="w-2.5 h-2.5" /> {cinema.distanceKm} km
                                </span>
                              )}
                              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </button>
                          {isExpanded && <div className="space-y-3 border-t border-border p-4">
                            {(cinema.movies || []).map(movie => {
                              const dates = Array.isArray(movie.dates) ? movie.dates : [];
                              return (
                                <div key={movie.movieId} className="flex gap-3">
                                  <img src={movie.moviePoster || ''} alt={movie.movieTitle} onError={handleImgError}
                                    className="w-10 h-14 rounded-lg object-cover shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <h5 className="text-xs font-semibold text-purple-400 mb-1.5">{movie.movieTitle}</h5>
                                    <div className="space-y-1.5">
                                    {dates.map(({ date, showtimes }) => {
                                      const stList = Array.isArray(showtimes) ? showtimes : [];
                                      return (
                                        <div key={date} className="flex items-start gap-2">
                                          <Calendar className="w-3 h-3 text-purple-400 shrink-0 mt-1" />
                                          <div className="min-w-0 flex-1">
                                            <span className="text-[11px] font-semibold block mb-1 text-muted-foreground">{getDateLabel(date)}</span>
                                            <div className="flex gap-1.5 flex-wrap">
                                              {stList.map(st => (
                                                <Link key={st.showtimeId}
                                                  to={`/movies/${st.movieId}/seats?time=${st.time}&date=${date}&cinema=${cinema.cinemaId}&showtimeId=${st.showtimeId}`}
                                                  className="px-2.5 py-1 rounded-lg bg-muted border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors text-xs font-semibold whitespace-nowrap">
                                                  {st.time}
                                                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">{formatCurrency(st.price)}</span>
                                                  {st.format && <span className="ml-1 text-[10px] text-blue-400">{st.format}</span>}
                                                </Link>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>}
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
  );
}
