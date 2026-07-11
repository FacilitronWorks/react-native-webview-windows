> ⚠️ **WIP — pre-release.** The component code inside is production-proven (running today in a shipping Expo + react-native-windows 0.83 new-architecture app), but this standalone package build has NOT yet been compile-validated. Do not consume until the first tagged release. If you're on react-native-webview >= 15, use upstream's in-tree Windows support instead.

# @facilitronworks/react-native-webview-windows

A `<WebView/>` for **react-native-windows New Architecture** (Fabric/Composition),
built on the WinUI 3 **WebView2** control hosted in a
`Microsoft.UI.Xaml.XamlIsland` and connected into the RN composition tree via
RNW's `ContentIslandComponentView` — no separate HWND, airspace-safe, scrolls
and clips with the RN tree.

> **STATUS: staged, pre-release.** The component code is extracted verbatim
> from a production app where it renders real web content today
> (react-native-windows 0.83.2 new-arch, WinAppSDK 1.8, ARM64; first pixel +
> load events verified on screen, July 2026). The **standalone library build
> of this repo has not been run yet** — see [Build validation](#build-validation).

## Should you use this, or upstream react-native-webview 15+?

**Check upstream first.** As of `react-native-webview@15.0.0`
(July 2026, [PR #3973](https://github.com/react-native-webview/react-native-webview/pull/3973)),
upstream ships its own **in-tree Windows New Architecture implementation**
with the same XamlIsland/ContentIsland architecture, plus features this
package does not have (onOpenWindow, onSourceChanged, working clearCache,
codegen'd specs, an example app and CI).

Use **this package** when:

- you are pinned to `react-native-webview` **<= 14** (13.x is common) and
  cannot take the v15 breaking release train, but need a working WebView on
  RNW new-arch **today**;
- you need the hardening this package has and upstream 15.0.0 does not
  (explicit `CoreWebView2Environment` with a packaged-app-safe, overridable
  user-data folder; init/navigation failures surfaced as `onError`;
  document-start message bridge; `injectedJavaScriptBeforeContentLoaded`);
- you want a probe-gated graceful fallback for OTA JS running on binaries
  that predate the native component.

Long-term, the intent is to upstream these deltas into react-native-webview
and retire this package. Do **not** enable both this component and upstream
15.x's Windows implementation in the same app: they don't collide at the
native layer (this package registers Fabric component `RNCWebView`; upstream
15.x registers `WebView2`/`RCTWebView2`) but you'd ship two WebView stacks and
two JS wrappers.

## Install

```sh
yarn add @facilitronworks/react-native-webview-windows
```

Autolinking (RNW CLI >= 0.63) picks up `windows/ReactNativeWebViewWindows.vcxproj`
and registers `ReactPackageProvider` automatically. No manual `App.cpp` edits.

### Consumption patterns

**A. Direct import (works on all platforms):**

```tsx
import { WebView } from '@facilitronworks/react-native-webview-windows'
// Windows -> this package's native component.
// iOS/Android/macOS -> transparently re-exports react-native-webview.
```

**B. Metro alias (zero call-site changes):** keep importing
`react-native-webview` everywhere and alias it on Windows in `metro.config.js`:

```js
resolver: {
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'windows' && moduleName === 'react-native-webview') {
      return context.resolveRequest(
        context,
        '@facilitronworks/react-native-webview-windows',
        platform,
      )
    }
    return context.resolveRequest(context, moduleName, platform)
  },
}
```

## Supported surface (v1 — everything listed is exercised in production)

Props:

| Prop | Notes |
| --- | --- |
| `source={{ uri }}` | full navigation, https/http/file/edge cases per WebView2 |
| `source={{ html }}` | via `NavigateToString`; **`baseUrl` is parsed but has no effect yet** (WebView2 has no NavigateToString-with-baseUrl; relative URLs in the HTML will 404) |
| `injectedJavaScript` | executed after each successful navigation |
| `injectedJavaScriptBeforeContentLoaded` | registered via `AddScriptToExecuteOnDocumentCreatedAsync` (true document-start, every page) |
| `javaScriptEnabled` | `CoreWebView2.Settings.IsScriptEnabled`; applied even when set before core init |
| `userAgent` | `CoreWebView2.Settings.UserAgent` |

Events (public API mapping mirrors react-native-webview's own `WebView.tsx`):

- `onLoadStart`, `onLoad`, `onLoadEnd`, `onNavigationStateChange` — payload:
  `{ url, title, loading, canGoBack, canGoForward }`
- `onError` — payload adds `{ code, description }`; fired for **failed
  navigations** (`CoreWebView2WebErrorStatus`) **and for CoreWebView2 init
  failures** (e.g. WebView2 Runtime missing), so your fallback UI actually runs
- `onMessage` — `window.ReactNativeWebView.postMessage(string)` from the page;
  the bridge is injected at document creation on every page

Ref commands (9): `injectJavaScript`, `postMessage`, `loadUrl`, `reload`,
`stopLoading`, `goBack`, `goForward`, `requestFocus`, `clearCache` (**no-op**,
see limitations).

Native configuration (C++, optional):

```cpp
// Before the first <WebView/> mounts — e.g. in App.cpp after package registration:
winrt::ReactNativeWebViewWindows::implementation::WebView2ComponentView::
    SetUserDataFolder(L"C:\\path\\to\\shared\\profile");
```

Default user-data folder: `ApplicationData LocalFolder\RNCWebViewWindows`
(packaged) or `%LOCALAPPDATA%\RNCWebViewWindows` (unpackaged). This is created
through an explicit `CoreWebView2Environment::CreateWithOptionsAsync`, so
packaged apps never depend on the runtime's default `<exe>.WebView2` folder
next to a read-only install directory.

## Limitations (honest list — read before adopting)

- **`clearCache` is a no-op** (planned: `CoreWebView2Profile.ClearBrowsingDataAsync`).
- **No cookies API** (`@react-native-cookies`-style management, `sharedCookiesEnabled`,
  `thirdPartyCookiesEnabled`): not implemented. Cookies live in this
  component's WebView2 profile; they are **isolated** from any other WebView2
  environment in your app unless you unify user-data folders via
  `SetUserDataFolder` (environment options must also match).
- **No downloads or file-upload API surface.** WebView2's built-in file picker
  works for `<input type=file>`, but there is no `onFileDownload`, no progress,
  no `RNCWebViewModule.isFileUploadSupported`.
- **`source.headers` / `method` / `body` are ignored** (parsed and skipped safely).
- **`onShouldStartLoadWithRequest`, `onHttpError`, `onLoadProgress`, `onScroll`,
  `onOpenWindow`, `onSourceChanged` are not implemented.** `target="_blank"` /
  `window.open` follows the WebView2 default (`NewWindowRequested` unhandled —
  the runtime opens its own popup window).
- **`originWhitelist` is not enforced natively.**
- **`source.html` + `baseUrl`**: baseUrl currently has no effect (see table).
- **WebView2 Evergreen Runtime required.** Inbox on Windows 11; can be absent
  on stripped/managed images and Server SKUs. Init failure is surfaced as
  `onError` (code = HRESULT) so you can render a fallback; no preflight
  version check yet.
- **Focus/keyboard routing** crosses three frameworks (RN island →
  ChildSiteLink → XAML island → Chromium). Programmatic `requestFocus` works;
  full tab-cycle/IME/accelerator matrices have not been exhaustively tested.
- **postMessage is string-only** with practical WebView2 size limits
  (single-digit MB); chunk large payloads.
- **New Architecture only.** On an old-arch RNW host the package compiles to a
  no-op, the availability probe returns `false`, and the JS renders a labeled
  placeholder instead of crashing.
- **XAML bootstrap cost**: registering the component sets `XamlSupport(true)`,
  so every app launch pays WinUI XamlApplication init (order tens of ms + a
  few MB) even if no WebView ever mounts.

## Architecture

```
<WebView/> (JS, this package)
  └─ Fabric component "RNCWebView"
       └─ WebView2ComponentView (C++/WinRT)
            ├─ Microsoft.UI.Xaml.Controls.WebView2   (WinUI 3 control)
            ├─ Microsoft.UI.Xaml.XamlIsland          (pure island, no HWND site)
            └─ island.ContentIsland() ──Connect()──▶ RNW ContentIslandComponentView
                                                     (ChildSiteLink: size/position/
                                                      scroll-transform/focus/UIA)
```

- Registration sets `builder.XamlSupport(true)`; RNW bootstraps the WinUI 3
  XAML framework at instance init. No app-side XAML code.
- Availability probe: `NativeModules.RNCWebViewWindowsInfo.isAvailable()` is a
  sync attributed module compiled in the same translation unit as the
  component — the probe can never disagree with component presence.
- Per-mount instances are keyed by the Fabric `Tag` and torn down on the
  view's `Destroying` event (XamlIsland is `Close()`d; leaked islands are
  known to break input routing window-wide).

## Build validation

**PENDING.** What exists and what has been proven:

- [x] Component `.cpp/.h` compile and run **inside a production app project**
      (RNW 0.83.2 built from source, WinAppSDK 1.8, ARM64, new-arch) — web
      content on screen.
- [ ] This standalone `windows/ReactNativeWebViewWindows.sln` has **not been
      built yet**. The project shape follows react-native-webview 15.0.0's
      windows project (RNW cpp-lib template). Expected friction points to
      check on first build:
      1. `Microsoft.Web.WebView2` / WinAppSDK WinUI projections under
         `UseExperimentalNuget=true` — may need an explicit PackageReference if
         the RNW CppLib property sheets don't flow WinAppSDK's transitive
         WebView2 package to library projects.
      2. `CppWinRTIncludes.h` availability in the lib include path (comes from
         RNW property sheets).
      3. `RNW_NEW_ARCH` definition flow from the consuming app vs
         `ExperimentalFeatures.props` when building the local sln.
- [ ] Autolink end-to-end in a fresh RNW 0.83 app.
- [ ] x64 and x86 builds (production evidence is ARM64).

## License

MIT. Portions of the project scaffolding follow the react-native-webview
windows project layout (MIT, Copyright Microsoft Corporation /
react-native-webview contributors).
