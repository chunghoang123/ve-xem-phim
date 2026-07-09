import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const FALLBACK_POSTER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">' +
  '<rect fill="#1e1b4b" width="300" height="450"/>' +
  '<text fill="#a855f7" font-family="Arial" font-size="48" text-anchor="middle" x="150" y="230">🎬</text>' +
  '<text fill="#6b7280" font-family="Arial" font-size="14" text-anchor="middle" x="150" y="280">No Poster</text>' +
  '</svg>'
);

export function posterUrl(url) {
  return url || FALLBACK_POSTER;
}

export function handleImgError(e) {
  e.target.src = FALLBACK_POSTER;
}
