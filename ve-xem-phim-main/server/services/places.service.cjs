require('dotenv').config();

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

async function searchNearby({ lat, lng, radius = 50000, maxResults = 20, types = ['movie_theater'] }) {
  if (!GOOGLE_MAPS_KEY) return [];
  try {
    const url = `${PLACES_API_BASE}/places:searchNearby`;
    const body = {
      includedTypes: types,
      maxResultCount: Math.min(maxResults, 20),
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius,
        },
      },
    };
    const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,places.websiteUri,places.priceLevel,places.businessStatus,places.primaryTypeDisplayName,places.photos,places.editorialSummary';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google Places API error:', data.error?.message || res.statusText);
      return [];
    }
    return (data.places || []).map(place => ({
      placeId: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      lat: place.location?.latitude || null,
      lng: place.location?.longitude || null,
      rating: place.rating || null,
      userRatingCount: place.userRatingCount || 0,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
      website: place.websiteUri || '',
      priceLevel: place.priceLevel || '',
      businessStatus: place.businessStatus || '',
      type: place.primaryTypeDisplayName?.text || '',
      photoRefs: (place.photos || []).map(p => p.name),
      summary: place.editorialSummary?.text || '',
    }));
  } catch (err) {
    console.error('Google Places searchNearby error:', err.message);
    return [];
  }
}

async function getPlaceDetails(placeId) {
  if (!GOOGLE_MAPS_KEY || !placeId) return null;
  try {
    const url = `${PLACES_API_BASE}/places/${placeId}`;
    const fieldMask = 'id,displayName,formattedAddress,rating,userRatingCount,nationalPhoneNumber,internationalPhoneNumber,location,websiteUri,priceLevel,businessStatus,primaryTypeDisplayName,photos,editorialSummary,regularOpeningHours,reviews';
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google Place Details error:', data.error?.message || res.statusText);
      return null;
    }
    return {
      placeId: data.id,
      name: data.displayName?.text || '',
      address: data.formattedAddress || '',
      lat: data.location?.latitude || null,
      lng: data.location?.longitude || null,
      rating: data.rating || null,
      userRatingCount: data.userRatingCount || 0,
      phone: data.nationalPhoneNumber || data.internationalPhoneNumber || '',
      website: data.websiteUri || '',
      priceLevel: data.priceLevel || '',
      businessStatus: data.businessStatus || '',
      type: data.primaryTypeDisplayName?.text || '',
      photoRefs: (data.photos || []).map(p => p.name),
      summary: data.editorialSummary?.text || '',
      openingHours: data.regularOpeningHours || null,
      reviews: (data.reviews || []).map(r => ({
        authorName: r.authorAttribution?.displayName || '',
        authorPhotoUri: r.authorAttribution?.photoUri || '',
        rating: r.rating,
        text: r.text?.text || '',
        relativeTime: r.relativePublishTimeDescription || '',
      })),
    };
  } catch (err) {
    console.error('Google Place Details error:', err.message);
    return null;
  }
}

async function getPlacePhoto(photoName, maxWidthPx = 400) {
  if (!GOOGLE_MAPS_KEY || !photoName) return null;
  try {
    const url = `${PLACES_API_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    return res.url;
  } catch {
    return null;
  }
}

module.exports = { searchNearby, getPlaceDetails, getPlacePhoto };
