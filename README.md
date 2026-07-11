> ⚠️ **WIP — pre-release, not npm-published.** The component code inside is production-proven (running today in a shipping Expo + react-native-windows 0.83 new-architecture app), and the standalone `windows/ReactNativeWebViewWindows.sln` now **builds clean on ARM64 and x64, Debug and Release** (see [Build validation](#build-validation)). Autolink-in-a-fresh-app and device/runtime testing of the standalone build are still outstanding, so this is not yet a tagged release — don't consume until then. If you're on react-native-webview >= 15, use upstream's in-tree Windows support instead.

# @facilitronworks/react-native-webview-windows

A `<WebView/>` for **react-native-windows New Architecture** (Fabric/Composition),
built on the WinUI 3 **WebView2** control hosted in a
`Microsoft.UI.Xaml.XamlIsland` and connected into the RN composition tree via
RNW's `ContentIslandComponentView` — no separate HWND, airspace-safe, scrolls
and clips with the RN tree.

> **STATUS: staged, pre-release, not npm-published.** The component code is
> extracted verbatim from a production app where it renders real web content
> today (react-native-windows 0.83.2 new-arch, WinAppSDK 1.8, ARM64; first
> pixel + load events verified on screen, July 2026). The **standalone
> `windows/ReactNativeWebViewWindows.sln` now compile-validates clean**
> (ARM64 + x64, Debug + Release, zero errors/warnings) — see
> [Build validation](#build-validation) for toolchain, date, and the two real
> issues that were found and fixed to get there. Autolinking into a fresh RNW
> app and on-device runtime testing of *this exact standalone build* (as
> opposed to the in-app-extracted original) are still outstanding.

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

**PASSED** — `windows/ReactNativeWebViewWindows.sln` builds clean, standalone,
outside of any consuming app.

| Platform | Configuration | Result |
| --- | --- | --- |
| ARM64 | Debug | ✅ 0 errors, 0 warnings |
| ARM64 | Release | ✅ 0 errors, 0 warnings |
| x64 | Debug | ✅ 0 errors, 0 warnings |
| x64 | Release | ✅ 0 errors, 0 warnings |
| x86 | — | not yet run |

- **Date:** July 2026.
- **Toolchain:** Visual Studio 2022 (17.14), MSBuild 17.14.40, `v143` toolset,
  Windows SDK 10.0.22621.0. `react-native-windows` 0.83.2 as the
  `ReactNativeWindowsDir` reference (`Microsoft.ReactNative`/`.Cxx` NuGet
  0.83.2, `Microsoft.WindowsAppSDK` 1.8.260508005, `Microsoft.Web.WebView2`
  1.0.3179.45, `Microsoft.Windows.CppWinRT` 2.0.230706.1). Output: a clean
  `ReactNativeWebViewWindows.dll` / `.winmd` per platform/config, no
  consuming app required (`RunAutolinkCheck=false`, `RunCodegenWindows=false`
  as already set in the `.vcxproj`).
- **Command:** `msbuild windows/ReactNativeWebViewWindows.sln /t:Restore` then
  `/p:Configuration=<Debug|Release> /p:Platform=<ARM64|x64>`, with
  `ReactNativeWindowsDir` resolved either by placing the package under a
  `node_modules/react-native-windows`-having ancestor (the normal consumption
  path — `GetDirectoryNameOfFileAbove` in the `.vcxproj` finds it
  automatically) or by passing it explicitly:
  `/p:ReactNativeWindowsDir=<path-to>\node_modules\react-native-windows\`.

Two real, repo-fixable issues were found and fixed to get a green build (both
committed to this repo):

1. **Missing `NuGet.config` → NU1101 on any machine without Microsoft's
   private feed pre-configured.** `UseExperimentalNuget=true` pulls
   `Microsoft.ReactNative` / `Microsoft.ReactNative.Cxx` as NuGet
   `PackageReference`s, but those two packages are **not on the public
   nuget.org gallery** — they're published only to
   `https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/nuget/v3/index.json`.
   Confirmed via each package's `.nupkg.metadata` (`"source"` field) after a
   real restore. Without a repo-level `NuGet.config` declaring both
   `nuget.org` (boost, `Microsoft.Windows.CppWinRT`,
   `Microsoft.VCRTForwarders.140`, `Microsoft.WindowsAppSDK*`,
   `Microsoft.Web.WebView2`) and that feed (`Microsoft.ReactNative*`) with
   package source mapping, `msbuild /t:Restore` fails on a clean
   machine/CI even though it happened to succeed on the dev box that already
   had those exact package versions cached from an unrelated build. **Fix:**
   added `NuGet.config` at the repo root, mirroring upstream
   react-native-webview's own windows template `NuGet.config` (same two
   sources, same mapping).
2. **`C1083: Cannot open include file:
   'winrt/impl/Windows.ApplicationModel.DataTransfer.DragDrop.2.h'`
   — a real MSVC `MAX_PATH` (260-char) boundary, not a missing reference.**
   The file cppwinrt.exe generates is byte-for-byte correct and present on
   disk (verified against an identical file from a known-good production
   build); `cl.exe` simply can't open it once the absolute path — repo root +
   `windows\ReactNativeWebViewWindows\<Platform>\<Config>\Generated
   Files\winrt\impl\<name>.h` — lands at or past 260 characters. This is not
   fixed by the OS-level `LongPathsEnabled=1` registry key (confirmed already
   set on the build machine; `cl.exe`'s own include-file resolution doesn't
   honor it). It reproduced reliably from this package's assigned CI/agent
   working directory (a deeply-nested temp path) and disappeared once
   intermediates were written under a short root — **it will also bite real
   consumers with a deep repo/`node_modules` path** (this is a known,
   Microsoft-documented react-native-windows pain point, see
   [win10-compat](https://microsoft.github.io/react-native-windows/docs/win10-compat)).
   **Fix:** no source change was correct here (the `.vcxproj`'s
   `IntDir`/`GeneratedFilesDir` already match upstream react-native-webview's
   own template exactly — shortening them arbitrarily would just move the
   problem). Documenting it here instead: if you hit this error on a file
   that verifiably exists on disk, either check out closer to a drive root,
   or override the intermediate directory to something short at build time,
   e.g. `msbuild ... /p:IntDir=C:\o\ARM64\Debug\ /p:OutDir=C:\o\ARM64\Debug\`.

Still outstanding:

- [ ] Autolink end-to-end in a fresh RNW 0.83 app (this validation exercised
      the library project directly, not through autolinking).
- [ ] x86 build.
- [ ] On-device runtime smoke test of *this exact standalone build's* output
      DLL (the production evidence above is from the in-app-extracted
      original source, not this repo's own build output).

## License

MIT. Portions of the project scaffolding follow the react-native-webview
windows project layout (MIT, Copyright Microsoft Corporation /
react-native-webview contributors).
