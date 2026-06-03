import { isNative } from './platform'

export async function registerPushNotifications(userId, supabase) {
  if (!isNative()) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      if (!token?.value) return
      await supabase
        .from('user_profile')
        .update({ push_token: token.value })
        .eq('id', userId)
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Notification received while app is foregrounded
      console.log('Push received:', notification.title)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // User tapped a notification — navigate to relevant page
      const url = action.notification.data?.url || action.notification.data?.target_url
      if (url) {
        if (url.startsWith('http')) window.location.href = url
        else window.location.hash = url
      }
    })
  } catch (err) {
    console.error('Push notification setup failed:', err)
  }
}
