/**
 * Haversine formula to calculate distance in meters between two lat/lng coordinates.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Get staff's current GPS position via Browser Geolocation API.
 */
export function getCurrentGpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 10,
          timestamp: position.timestamp
        });
      },
      (error) => {
        // Fallback default position (e.g. Maharashtra region center) if denied/unavailable
        resolve({
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 50,
          isFallback: true,
          error: error.message
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}

/**
 * Sort array of farmers by distance from staff's GPS position.
 */
export function sortFarmersByDistance(farmers, staffLat, staffLng) {
  if (!staffLat || !staffLng || !farmers) return farmers;
  
  return [...farmers].map(farmer => {
    let distance = null;
    if (farmer.latitude && farmer.longitude) {
      distance = calculateHaversineDistance(staffLat, staffLng, farmer.latitude, farmer.longitude);
    }
    return { ...farmer, calculated_distance: distance };
  }).sort((a, b) => {
    if (a.calculated_distance === null) return 1;
    if (b.calculated_distance === null) return -1;
    return a.calculated_distance - b.calculated_distance;
  });
}
