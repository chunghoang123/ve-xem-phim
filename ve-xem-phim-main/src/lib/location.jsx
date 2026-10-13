import { useState, useEffect } from "react";
import { api } from "./api";
import { LocationContext } from "./location-context";

export function LocationProvider({ children }) {
  const [locations, setLocations] = useState({ cities: [], provinces: [] });
  const [brands, setBrands] = useState([]);
  const [selectedCity, setSelectedCity] = useState(() => localStorage.getItem("cinex_city") || "");
  const [selectedProvince, setSelectedProvince] = useState(() => {
    const id = localStorage.getItem("cinex_province_id");
    return id ? Number(id) : null;
  });
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    api.get("/cinemas/locations").then((res) => {
      setLocations(res.data?.locations || { cities: [], provinces: [] });
      setBrands(res.data?.brands || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCity) localStorage.setItem("cinex_city", selectedCity);
    if (selectedProvince) localStorage.setItem("cinex_province_id", String(selectedProvince));
  }, [selectedCity, selectedProvince]);

  const provinces = locations.provinces || [];
  const cities = locations.cities || [];

  const regions = [...new Set(provinces.map(p => p.region))];

  const provincesByRegion = (region) => provinces.filter(p => p.region === region);

  const requestGeolocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  const searchNearbyPlaces = async ({ lat, lng, radius = 50000, maxResults = 20, types } = {}) => {
    const params = new URLSearchParams();
    const useLat = lat ?? userCoords?.lat;
    const useLng = lng ?? userCoords?.lng;
    if (!useLat || !useLng) return [];
    params.set('lat', useLat);
    params.set('lng', useLng);
    if (radius) params.set('radius', radius);
    if (maxResults) params.set('maxResults', maxResults);
    if (types) params.set('types', types);
    try {
      const res = await api.get(`/cinemas/places/nearby?${params}`);
      return res.data || [];
    } catch {
      return [];
    }
  };

  const fetchPlaceDetails = async (placeId) => {
    try {
      const res = await api.get(`/cinemas/places/${placeId}`);
      return res.data || null;
    } catch {
      return null;
    }
  };

  return (
    <LocationContext value={{
      locations, brands, cities, provinces, regions, provincesByRegion,
      selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince,
      userCoords, setUserCoords,
      requestGeolocation,
      searchNearbyPlaces, fetchPlaceDetails,
    }}>
      {children}
    </LocationContext>
  );
}
