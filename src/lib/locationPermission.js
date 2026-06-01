import { isNative } from './platform'

export async function requestLocationPermission() {
  if (!isNative()) return true // Web — browser handles it natively

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const permission = await Geolocation.requestPermissions()
    return permission.location === 'granted'
  } catch {
    return false
  }
}

export async function getCurrentPosition() {
  if (!isNative()) {
    // Web fallback — existing browser API
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      })
    })
  }

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
    // Return a shape compatible with browser GeolocationPosition
    return {
      coords: {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
      },
      timestamp: pos.timestamp,
    }
  } catch (e) {
    throw new Error('Unable to get location: ' + e.message)
  }
}
