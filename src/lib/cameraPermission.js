import { isNative } from './platform'

export async function takePhoto() {
  if (!isNative()) {
    // Web — caller handles via file input; signal to use web path
    return null
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const permission = await Camera.requestPermissions()

    if (permission.camera !== 'granted') {
      alert('Camera permission is required. Please enable it in iPhone Settings > PostCommand > Camera.')
      return null
    }

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    })

    return image.dataUrl // base64 data URL ready for Supabase upload
  } catch (e) {
    if (e.message !== 'User cancelled photos app') {
      console.error('[PostCommand] Camera error:', e.message)
    }
    return null
  }
}
