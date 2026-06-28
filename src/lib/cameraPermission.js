import { isNative } from './platform'

export async function takePhoto() {
  if (!isNative()) return null

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const permission = await Camera.requestPermissions()

    if (permission.camera !== 'granted') {
      const err = new Error('CAMERA_PERMISSION_DENIED')
      err.code = 'CAMERA_PERMISSION_DENIED'
      throw err
    }

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    })

    return image.dataUrl
  } catch (e) {
    if (e.code === 'CAMERA_PERMISSION_DENIED') throw e
    if (e.message === 'User cancelled photos app') return null
    console.error('[PostCommand] Camera error:', e.message)
    const err = new Error('CAMERA_ERROR')
    err.code = 'CAMERA_ERROR'
    throw err
  }
}
