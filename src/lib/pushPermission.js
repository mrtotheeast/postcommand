import { isNative } from './platform'

export async function requestPushPermission() {
  if (!isNative()) return // Web uses existing VAPID flow in pushNotifications.js

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const permission = await PushNotifications.requestPermissions()

    if (permission.receive === 'granted') {
      await PushNotifications.register()

      PushNotifications.addListener('registration', token => {
        // Store APNs token for this device — save to push_subscription table
        console.log('[PostCommand] APNs push token:', token.value)
        // TODO: upsert to push_subscription with token.value as endpoint
      })

      PushNotifications.addListener('registrationError', err => {
        console.error('[PostCommand] APNs registration error:', err)
      })

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[PostCommand] Push received in foreground:', notification)
      })

      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        // Navigate based on notification data when user taps the notification
        const data = action.notification.data
        if (data?.route) window.location.href = data.route
      })
    }
  } catch (e) {
    // Graceful — push notifications unavailable (simulator, permission denied, etc.)
    console.log('[PostCommand] Push notifications not available:', e.message)
  }
}
