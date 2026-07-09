import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Clock, ChevronRight, Sparkles, Ticket, Shield, Zap } from "lucide-react";
import { formatCurrency, handleImgError } from "../lib/utils";
import { api } from "../lib/api";
import TrailerModal from "../components/TrailerModal";
import MovieCard from "../components/MovieCard";

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [slideDir, setSlideDir] = useState("right");
  const intervalRef = useRef(null);
  const prevIndexRef = useRef(0);

  const goToSlide = useCallback((i) => {
    const prev = prevIndexRef.current;
    setSlideDir(i > prev ? "right" : "left");
    prevIndexRef.current = i;
    setHeroIndex(i);
  }, []);

  useEffect(() => {
    api.get("/movies?limit=8&sort_by=popularity&sort_order=DESC&status=active")
      .then((res) => setMovies(res.data || []))
      .catch(() => {});
  }, []);

  const heroCount = Math.min(movies.length, 4);

  useEffect(() => {
    if (heroCount < 2) return;
    intervalRef.current = setInterval(() => {
      goToSlide((prevIndexRef.current + 1) % heroCount);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [heroCount, goToSlide]);

  const heroMovie = movies[heroIndex] || movies[0];

  const nowShowing = movies.slice(0, 4);
  const comingSoon = movies.slice(4, 8).length > 0 ? movies.slice(4, 8) : [];

  return (
    <div className="min-h-screen w-full">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {movies.slice(0, heroCount).map((m, i) => (
            <img key={m.id} src={m.backdrop || m.poster || ''} alt="" onError={handleImgError}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(${(i - heroIndex) * 100}%)`,
              }} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />
        </div>
        {heroMovie && (
          <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-0">
            <div className="max-w-xl min-h-[400px] flex flex-col">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs sm:text-sm font-medium mb-5 sm:mb-6 shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Đang chiếu
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight shrink-0"
                key={heroMovie.id}
                style={{
                  animation: `slideIn${slideDir === "right" ? "FromRight" : "FromLeft"} 0.5s ease-out`,
                }}>
                {heroMovie.title}
              </h1>
              <div className="flex-1 relative my-4 sm:my-5">
                <p className="text-muted-foreground text-sm sm:text-base lg:text-lg leading-relaxed line-clamp-3 absolute inset-0"
                  key={`desc-${heroMovie.id}`}
                  style={{
                    animation: `slideIn${slideDir === "right" ? "FromRight" : "FromLeft"} 0.5s ease-out 0.1s both`,
                  }}>
                  {heroMovie.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground shrink-0"
                key={`meta-${heroMovie.id}`}
                style={{
                  animation: `slideIn${slideDir === "right" ? "FromRight" : "FromLeft"} 0.5s ease-out 0.15s both`,
                }}>
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> {heroMovie.vote_average?.toFixed(1) || '8.5'}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> {heroMovie.duration} phút
                </span>
                <span className="text-border">|</span>
                <span className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium">{heroMovie.rating}</span>
                <span className="text-border">|</span>
                <span>{heroMovie.genre}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-6 shrink-0">
                <Link to={`/movies/${heroMovie.id}`}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm sm:text-base font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25">
                  <Ticket className="w-5 h-5" />
                  Đặt vé ngay
                </Link>
                <button onClick={() => { setTrailerUrl(heroMovie?.trailer_url); setShowTrailer(true); }}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl border border-border bg-card/50 backdrop-blur hover:bg-muted transition-colors text-sm sm:text-base font-medium cursor-pointer">
                  <Play className="w-5 h-5" />
                  Trailer
                </button>
                {showTrailer && <TrailerModal url={trailerUrl} onClose={() => setShowTrailer(false)} />}
              </div>
              <div className="flex gap-2 shrink-0 mt-6">
                {Array.from({ length: heroCount }).map((_, i) => (
                  <button key={i} onClick={() => { goToSlide(i); clearInterval(intervalRef.current); }}
                    className={`w-2 h-2 rounded-full transition-all ${i === heroIndex ? "w-6 bg-purple-400" : "bg-white/40 hover:bg-white/60"}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="py-10 sm:py-14 border-b border-border">
        <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {[
              { icon: Ticket, title: "Đặt vé nhanh chóng", desc: "Chọn ghế và thanh toán chỉ trong vài bước" },
              { icon: Shield, title: "Thanh toán an toàn", desc: "Bảo mật tuyệt đối với nhiều cổng thanh toán" },
              { icon: Zap, title: "Ưu đãi độc quyền", desc: "Nhiều khuyến mãi hấp dẫn cho thành viên" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base mb-0.5">{title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Now Showing */}
      <section className="py-12 sm:py-16">
        <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-7 sm:mb-9">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Đang chiếu</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">Những bộ phim hot nhất hiện nay</p>
            </div>
            <Link to="/movies" className="flex items-center gap-1 text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-semibold shrink-0">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
            {nowShowing.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      {comingSoon.length > 0 && (
        <section className="py-12 sm:py-16 bg-card/30">
          <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-7 sm:mb-9">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Sắp chiếu</h2>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">Đón chờ những bộ phim sắp ra mắt</p>
              </div>
              <Link to="/movies" className="flex items-center gap-1 text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-semibold shrink-0">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
              {comingSoon.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

