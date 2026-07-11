/*
 * RNCWebViewNativeComponent — the Fabric host-component handle for the native
 * "RNCWebView" component (windows/ReactNativeWebViewWindows/
 * WebView2ComponentView.cpp) on react-native-windows New Architecture.
 *
 * WHY HAND-EXPANDED (no codegenNativeComponent): codegenNativeComponent is a
 * BABEL-TIME macro; whether @react-native/babel-plugin-codegen transforms a
 * file depends on its filename/location, which is fragile for library files
 * under some Metro setups (verified under Expo's Metro). NativeComponentRegistry
 * .get(...) is exactly what the codegen would emit — deterministic at runtime,
 * no transform required, and the canonical pattern used by RNW's own Fabric
 * components. codegenNativeCommands, by contrast, IS a runtime API and is used
 * as-is.
 *
 * EVENT NAMES: the native side emits top-prefixed Fabric event types verbatim
 * (AbiEventEmitter -> core dispatchEvent; normalizeEventType passes "top*"
 * through). directEventTypes below maps them onto the callback props.
 *
 * IMPORT THIS ONLY from WebView.windows.tsx, and only after the
 * RNCWebViewWindowsInfo availability probe returned true — registering a view
 * config for a component the binary doesn't have would mount a native
 * "Unimplemented component" box.
 */

import type { HostComponent, ViewProps } from 'react-native'
// Internal-but-stable RN registry (same module every codegen'd spec requires).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NativeComponentRegistry = require('react-native/Libraries/NativeComponent/NativeComponentRegistry')
// Runtime helper (NOT a babel macro) that wraps UIManager/Fabric dispatchCommand.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const codegenNativeCommands = require('react-native/Libraries/Utilities/codegenNativeCommands').default

export interface NativeWebViewNavigationEvent {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface NativeWebViewErrorEvent extends NativeWebViewNavigationEvent {
  code: number
  description: string
}

export interface NativeProps extends ViewProps {
  source?: { uri?: string; html?: string; baseUrl?: string }
  injectedJavaScript?: string
  injectedJavaScriptBeforeContentLoaded?: string
  javaScriptEnabled?: boolean
  userAgent?: string
  onLoadingStart?: (e: { nativeEvent: NativeWebViewNavigationEvent }) => void
  onLoadingFinish?: (e: { nativeEvent: NativeWebViewNavigationEvent }) => void
  onLoadingError?: (e: { nativeEvent: NativeWebViewErrorEvent }) => void
  onMessage?: (e: { nativeEvent: { data: string } }) => void
}

export const __INTERNAL_VIEW_CONFIG = {
  uiViewClassName: 'RNCWebView',
  bubblingEventTypes: {},
  directEventTypes: {
    topLoadingStart: { registrationName: 'onLoadingStart' },
    topLoadingFinish: { registrationName: 'onLoadingFinish' },
    topLoadingError: { registrationName: 'onLoadingError' },
    topMessage: { registrationName: 'onMessage' },
  },
  validAttributes: {
    source: true,
    injectedJavaScript: true,
    injectedJavaScriptBeforeContentLoaded: true,
    javaScriptEnabled: true,
    userAgent: true,
  },
} as const

const RNCWebViewWindows: HostComponent<NativeProps> = NativeComponentRegistry.get(
  'RNCWebView',
  () => __INTERNAL_VIEW_CONFIG,
)

// Command names must match WebView2ComponentView.cpp's HandleCommand switch.
export interface NativeCommands {
  injectJavaScript: (ref: React.ElementRef<HostComponent<NativeProps>>, script: string) => void
  postMessage: (ref: React.ElementRef<HostComponent<NativeProps>>, message: string) => void
  loadUrl: (ref: React.ElementRef<HostComponent<NativeProps>>, url: string) => void
  reload: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
  stopLoading: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
  goBack: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
  goForward: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
  requestFocus: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
  clearCache: (ref: React.ElementRef<HostComponent<NativeProps>>) => void
}

export const Commands: NativeCommands = codegenNativeCommands({
  supportedCommands: [
    'injectJavaScript',
    'postMessage',
    'loadUrl',
    'reload',
    'stopLoading',
    'goBack',
    'goForward',
    'requestFocus',
    'clearCache',
  ],
})

export default RNCWebViewWindows
