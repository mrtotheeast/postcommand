// Detects if running inside Capacitor native iOS/Android shell
export const isNative = () => window?.Capacitor?.isNativePlatform?.() ?? false
export const isIOS    = () => window?.Capacitor?.getPlatform?.() === 'ios'
export const isAndroid = () => window?.Capacitor?.getPlatform?.() === 'android'

// Open a URL in the system browser (safe across web + native)
export async function openBrowser(url) {
  if (isNative()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
    } catch {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}
