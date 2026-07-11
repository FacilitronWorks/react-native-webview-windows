/*
 * react-native-webview-compatible <WebView/> for react-native-windows New
 * Architecture (Fabric/Composition).
 *
 * NATIVE-FIRST WITH GRACEFUL FALLBACK:
 * - The real native view is the Fabric component "RNCWebView"
 *   (windows/ReactNativeWebViewWindows/WebView2ComponentView.cpp — WinUI 3
 *   WebView2 hosted in a XamlIsland connected into RNW's
 *   ContentIslandComponentView).
 * - Availability is probed via NativeModules.RNCWebViewWindowsInfo
 *   .isAvailable(), an attributed module compiled in the SAME translation unit
 *   as the component, so the probe can never disagree with component presence.
 *   This matters because OTA/CodePush-style deployments ship this JS onto
 *   binaries that may predate the component — those must render the labeled
 *   placeholder, not a red box.
 * - Fallback: a labeled placeholder box.
 *
 * Event mapping (native emits discrete events; the public API derives the
 * rest — mirrors what react-native-webview's own WebView.tsx does):
 *   onLoadingStart  -> onLoadStart + onNavigationStateChange(loading: true)
 *   onLoadingFinish -> onLoad + onLoadEnd + onNavigationStateChange
 *   onLoadingError  -> onError + onLoadEnd
 *   onMessage       -> onMessage
 *
 * RNW is a real native RN platform: only 'react-native' primitives here.
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactElement,
  type ElementRef,
} from 'react'
import {
  NativeModules,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import RNCWebViewWindows, {
  Commands,
  type NativeWebViewErrorEvent,
  type NativeWebViewNavigationEvent,
} from './RNCWebViewNativeComponent.windows'

type WebViewSource =
  | { uri: string; headers?: Record<string, string>; method?: string; body?: string }
  | { html: string; baseUrl?: string }

export interface WebViewMessageEvent {
  nativeEvent: { data: string }
}

export interface WebViewNavigation {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface WebViewErrorEvent {
  nativeEvent: WebViewNavigation & { code: number; description: string }
}

export interface WebViewProps {
  source?: WebViewSource
  style?: StyleProp<ViewStyle>
  injectedJavaScript?: string
  injectedJavaScriptBeforeContentLoaded?: string
  javaScriptEnabled?: boolean
  userAgent?: string
  scrollEnabled?: boolean
  originWhitelist?: string[]
  allowsFullscreenVideo?: boolean
  mediaPlaybackRequiresUserAction?: boolean
  onMessage?: (event: WebViewMessageEvent) => void
  onLoad?: (event: { nativeEvent: WebViewNavigation }) => void
  onLoadEnd?: (event: { nativeEvent: WebViewNavigation }) => void
  onLoadStart?: (event: { nativeEvent: WebViewNavigation }) => void
  onError?: (event: WebViewErrorEvent) => void
  onNavigationStateChange?: (nav: WebViewNavigation) => void
  renderLoading?: () => ReactElement
  testID?: string
}

export interface WebViewHandle {
  injectJavaScript: (script: string) => void
  postMessage: (message: string) => void
  reload: () => void
  goBack: () => void
  goForward: () => void
  stopLoading: () => void
  requestFocus: () => void
  clearCache?: (includeDiskFiles: boolean) => void
}

// Binary-accurate probe (see header). Guarded: on any older binary the module
// is simply absent from NativeModules; a sync-method throw is also treated as
// absent. On old-architecture hosts the module exists but returns false.
const isNativeWebViewAvailable = (): boolean => {
  try {
    return NativeModules?.RNCWebViewWindowsInfo?.isAvailable?.() === true
  } catch {
    return false
  }
}
const NATIVE_AVAILABLE = isNativeWebViewAvailable()

// ---------------------------------------------------------------------------
// Native-backed implementation
// ---------------------------------------------------------------------------

const NativeWebView = forwardRef<WebViewHandle, WebViewProps>((props, ref) => {
  const {
    source,
    style,
    injectedJavaScript,
    injectedJavaScriptBeforeContentLoaded,
    javaScriptEnabled,
    userAgent,
    onMessage,
    onLoad,
    onLoadEnd,
    onLoadStart,
    onError,
    onNavigationStateChange,
    testID,
  } = props

  const nativeRef = useRef<ElementRef<typeof RNCWebViewWindows>>(null)

  useImperativeHandle(
    ref,
    () => ({
      injectJavaScript: (script: string) => {
        if (nativeRef.current) Commands.injectJavaScript(nativeRef.current, script)
      },
      postMessage: (message: string) => {
        if (nativeRef.current) Commands.postMessage(nativeRef.current, message)
      },
      reload: () => {
        if (nativeRef.current) Commands.reload(nativeRef.current)
      },
      goBack: () => {
        if (nativeRef.current) Commands.goBack(nativeRef.current)
      },
      goForward: () => {
        if (nativeRef.current) Commands.goForward(nativeRef.current)
      },
      stopLoading: () => {
        if (nativeRef.current) Commands.stopLoading(nativeRef.current)
      },
      requestFocus: () => {
        if (nativeRef.current) Commands.requestFocus(nativeRef.current)
      },
      clearCache: () => {
        if (nativeRef.current) Commands.clearCache(nativeRef.current)
      },
    }),
    [],
  )

  const handleLoadingStart = useCallback(
    (e: { nativeEvent: NativeWebViewNavigationEvent }) => {
      onLoadStart?.(e)
      onNavigationStateChange?.(e.nativeEvent)
    },
    [onLoadStart, onNavigationStateChange],
  )

  const handleLoadingFinish = useCallback(
    (e: { nativeEvent: NativeWebViewNavigationEvent }) => {
      onLoad?.(e)
      onLoadEnd?.(e)
      onNavigationStateChange?.(e.nativeEvent)
    },
    [onLoad, onLoadEnd, onNavigationStateChange],
  )

  const handleLoadingError = useCallback(
    (e: { nativeEvent: NativeWebViewErrorEvent }) => {
      onError?.(e)
      onLoadEnd?.(e)
    },
    [onError, onLoadEnd],
  )

  return (
    <RNCWebViewWindows
      ref={nativeRef}
      // Default flex:1 mirrors react-native-webview (a WebView should fill).
      style={[styles.nativeFill, style]}
      source={source}
      injectedJavaScript={injectedJavaScript}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
      javaScriptEnabled={javaScriptEnabled !== false}
      userAgent={userAgent}
      onLoadingStart={handleLoadingStart}
      onLoadingFinish={handleLoadingFinish}
      onLoadingError={handleLoadingError}
      onMessage={onMessage}
      testID={testID}
    />
  )
})
NativeWebView.displayName = 'WebViewWindows'

// ---------------------------------------------------------------------------
// Placeholder fallback (old binaries / old-arch hosts)
// ---------------------------------------------------------------------------

const describeSource = (source?: WebViewSource): string => {
  if (!source) return 'no source'
  if ('uri' in source && source.uri) return source.uri
  if ('html' in source && source.html) return 'inline HTML'
  return 'no source'
}

const PlaceholderWebView = forwardRef<WebViewHandle, WebViewProps>(
  ({ source, style, testID }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        injectJavaScript: () => {},
        postMessage: () => {},
        reload: () => {},
        goBack: () => {},
        goForward: () => {},
        stopLoading: () => {},
        requestFocus: () => {},
        clearCache: () => {},
      }),
      [],
    )

    return (
      <View style={[styles.container, style]} testID={testID}>
        <Text style={styles.title}>WebView unavailable on Windows</Text>
        <Text style={styles.detail} numberOfLines={2}>
          {describeSource(source)}
        </Text>
        <Text style={styles.hint}>
          This binary does not include the native WebView2 component (New
          Architecture required); update the app.
        </Text>
      </View>
    )
  },
)
PlaceholderWebView.displayName = 'WebViewWindowsPlaceholder'

const styles = StyleSheet.create({
  nativeFill: {
    flex: 1,
  },
  container: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F2F4F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D5DD',
    borderRadius: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#344054',
    textAlign: 'center',
  },
  detail: {
    marginTop: 6,
    fontSize: 12,
    color: '#475467',
    textAlign: 'center',
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    color: '#98A2B3',
    textAlign: 'center',
  },
})

const WebView = NATIVE_AVAILABLE ? NativeWebView : PlaceholderWebView

export { WebView }
export default WebView
