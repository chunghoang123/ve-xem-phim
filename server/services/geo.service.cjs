require('dotenv').config();

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}&language=vi`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch (err) {
    console.error('Geocode error:', err.message);
  }
  return null;
}

async function getDistanceMatrix(origins, destinations) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const originStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_KEY}&language=vi&units=metric`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') return data;
  } catch (err) {
    console.error('Distance Matrix error:', err.message);
  }
  return null;
}

module.exports = { haversine, geocodeAddress, getDistanceMatrix };
