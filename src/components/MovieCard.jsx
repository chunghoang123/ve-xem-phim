import { Link } from "react-router-dom";
import { Star, Clock } from "lucide-react";
import { formatCurrency, handleImgError } from "../lib/utils";

export default function MovieCard({ movie, index }) {
  return (
    <Link to={`/movies/${movie.id}`}
      className="group block"
        style={index !== undefined ? { animation: `enter 0.4s ease-out ${index * 0.08}s both` } : undefined}>
        <div className="relative aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden mb-3">
          <img src={movie.poster || ''} alt={movie.title} onError={handleImgError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{movie.rating || "P"}</span>
              <span className="text-white/40">•</span>
              <span>{movie.duration} phút</span>
            </div>
          </div>
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-[10px] sm:text-xs font-semibold text-white">
              {movie.rating}
            </span>
          </div>
        </div>
        <h3 className="font-semibold text-xs sm:text-sm leading-snug group-hover:text-purple-400 transition-colors line-clamp-1">
          {movie.title}
        </h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{movie.genre?.split(",")[0] || movie.genre}</p>
        <p className="text-[10px] sm:text-xs text-purple-400 font-semibold mt-1">
          Từ {formatCurrency(movie.ticket_price)}
        </p>
    </Link>
  );
}