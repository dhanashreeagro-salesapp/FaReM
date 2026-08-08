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

let cachedPosition = null;
let cachedPositionTimestamp = 0;

/**
 * Get staff's current GPS position via Browser Geolocation API.
 * Supports caching position for 30s and aborting ongoing request via signal/timeout.
 */
export function getCurrentGpsPosition(options = {}) {
  const { timeout = 12000, maxAge = 30000, forceRefresh = false, signal } = options;

  const now = Date.now();
  if (!forceRefresh && cachedPosition && (now - cachedPositionTimestamp < maxAge)) {
    return Promise.resolve(cachedPosition);
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const fallback = { latitude: 18.5204, longitude: 73.8567, accuracy: 50, isFallback: true, error: "Geolocation not supported" };
      resolve(fallback);
      return;
    }

    let isSettled = false;
    let watchId = null;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        const fallback = { latitude: 18.5204, longitude: 73.8567, accuracy: 50, isFallback: true, error: "GPS request timed out" };
        resolve(fallback);
      }
    }, timeout);

    if (signal) {
      signal.addEventListener('abort', () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          reject(new DOMException('Aborted by user', 'AbortError'));
        }
      });
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);

          const result = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 10,
            timestamp: position.timestamp
          };
          cachedPosition = result;
          cachedPositionTimestamp = Date.now();
          resolve(result);
        }
      },
      (error) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);

          const fallback = {
            latitude: 18.5204,
            longitude: 73.8567,
            accuracy: 50,
            isFallback: true,
            error: error.message
          };
          resolve(fallback);
        }
      },
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge: maxAge
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
