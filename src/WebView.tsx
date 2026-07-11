/*
 * Non-Windows platforms: this package is a Windows companion. If you import it
 * on iOS/Android/macOS, it transparently re-exports the real
 * `react-native-webview` (declared as an optional peer dependency) so a single
 * import site works everywhere:
 *
 *   import { WebView } from '@facilitronworks/react-native-webview-windows'
 *
 * Metro platform resolution picks WebView.windows.tsx on Windows and this file
 * elsewhere.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const upstream = require('react-native-webview')

export const WebView = upstream.WebView ?? upstream.default
export default WebView
