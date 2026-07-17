import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { api } from "../lib/api";
import MovieCard from "../components/MovieCard";

const genres = ["Tất cả", "Hành động", "Khoa học viễn tưởng", "Hoạt hình", "Hài hước", "Tiểu sử", "Hình sự", "Phiêu lưu"];

export default function Movies() {
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Tất cả");
  const [nowShowing, setNowShowing] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [activeSection, setActiveSection] = useState("nowShowing");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/movies/home?now_limit=50&upcoming_limit=50")
      .then((res) => {
        setNowShowing(res.data?.nowShowing || []);
        setUpcoming(res.data?.upcoming || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const movies = activeSection === "nowShowing" ? nowShowing : upcoming;
  const filtered = movies.filter((m) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchGenre = selectedGenre === "Tất cả" || (m.genre && m.genre.toLowerCase().includes(selectedGenre.toLowerCase()));
    return matchSearch && matchGenre;
  });

  if (loading) {
    return (
      <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 w-full flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 w-full">
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="mb-7 sm:mb-9">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1.5 sm:mb-2">Danh sách phim</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {activeSection === "nowShowing"
              ? "Chọn phim đang có lịch chiếu và đặt vé ngay"
              : "Các phim chuẩn bị ra mắt, chưa mở lịch đặt vé"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1.5 mb-6 sm:mb-8 max-w-md rounded-2xl bg-card border border-border">
          <button type="button" onClick={() => setActiveSection("nowShowing")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeSection === "nowShowing" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
            Đang chiếu ({nowShowing.length})
          </button>
          <button type="button" onClick={() => setActiveSection("upcoming")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeSection === "upcoming" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
            Sắp chiếu ({upcoming.length})
          </button>
        </div>

        <div className="mb-6 sm:mb-7">
          <div className="relative max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm phim..."
              className="w-full pl-11 pr-10 py-3 sm:py-3.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-3 mb-7 sm:mb-9 scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0">
          {genres.map((genre) => (
            <button key={genre} onClick={() => setSelectedGenre(genre)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                selectedGenre === genre
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/30"
              }`}>
              {genre}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 md:gap-6">
          {filtered.map((movie, i) => (
            <div key={movie.id} className="animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
              <MovieCard movie={movie} comingSoon={activeSection === "upcoming"} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 sm:py-20">
            <p className="text-muted-foreground text-sm sm:text-base">Không tìm thấy phim phù hợp</p>
          </div>
        )}
      </div>
    </div>
  );
}
