import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/Navbar";
import { LocationProvider } from "./lib/location";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ChatBox from "./components/ChatBox";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetail from "./pages/MovieDetail";
import SeatSelection from "./pages/SeatSelection";
import Checkout from "./pages/Checkout";
import Showtimes from "./pages/Showtimes";
import Promotions from "./pages/Promotions";
import Profile from "./pages/Profile";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMovies from "./pages/admin/AdminMovies";
import AdminShowtimes from "./pages/admin/AdminShowtimes";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminCinemas from "./pages/admin/AdminCinemas";
import AdminUsers from "./pages/admin/AdminUsers";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <Routes>
            <Route path="/*" element={
              <div className="min-h-screen flex flex-col bg-background text-foreground">
                <Navbar />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/movies" element={<Movies />} />
                    <Route path="/movies/:id" element={<MovieDetail />} />
                    <Route path="/movies/:id/seats" element={<SeatSelection />} />
                    <Route path="/movies/:id/checkout" element={<Checkout />} />
                    <Route path="/showtimes" element={<Showtimes />} />
                    <Route path="/promotions" element={<Promotions />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                </main>
                <Footer />
                <ChatBox />
              </div>
            } />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="movies" element={<AdminMovies />} />
              <Route path="showtimes" element={<AdminShowtimes />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="cinemas" element={<AdminCinemas />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Routes>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
