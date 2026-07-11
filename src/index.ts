// Platform resolution picks ./WebView.windows.tsx on react-native-windows and
// ./WebView.tsx (a passthrough to react-native-webview) everywhere else.
export { WebView, default } from './WebView'
export type {
  WebViewProps,
  WebViewHandle,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewErrorEvent,
} from './WebView.windows'
