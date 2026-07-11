#pragma once
#include "pch.h"
#include "NativeModules.h"

#include <string>

// ============================================================================
// WebView2ComponentView — react-native-webview implementation for
// react-native-windows New Architecture (Fabric/Composition).
//
// Registered Fabric component name: "RNCWebView" (react-native-webview 13.x's
// codegen native-component name, so a 13.x-compatible JS <WebView/> wrapper
// mounts this view).
//
// HOSTING (composition-island, airspace-safe):
//   WinUI 3 WebView2 control (Microsoft.UI.Xaml.Controls.WebView2)
//     -> Microsoft.UI.Xaml.XamlIsland (WinAppSDK 1.8+; pure island, NO HWND site)
//     -> .ContentIsland() handed to RNW's ContentIslandComponentView.Connect(),
//        which parents it into the RN Composition tree via a ChildSiteLink and
//        keeps size / position / scroll-transform / focus / UIA in sync.
//
// XAML FRAMEWORK BOOTSTRAP: registration sets builder.XamlSupport(true); RNW
// then creates its XamlApplication (WindowsXamlManager::InitializeForCurrentThread
// + WinUI resources) at instance init. No app-side XAML bootstrap is needed.
//
// REGISTRATION: performed automatically by this package's ReactPackageProvider
// (autolinking). Apps that hand-roll their package list can instead call
//   winrt::ReactNativeWebViewWindows::implementation::WebView2ComponentView::
//       RegisterViewComponent(packageBuilder);
//
// JS AVAILABILITY PROBE: this translation unit ALSO defines the tiny attributed
// module "RNCWebViewWindowsInfo" (REACT_MODULE — auto-registered by the package
// provider's AddAttributedModules call purely by being compiled in). The JS
// side checks NativeModules.RNCWebViewWindowsInfo?.isAvailable?.() and falls
// back to a labeled placeholder when the binary predates this component (OTA
// deployments ship JS onto old binaries; a Fabric component registration alone
// is not JS-detectable).
//
// PROVENANCE: extracted from a production react-native-windows 0.83.2 new-arch
// app (Expo monorepo, WinAppSDK 1.8, ARM64) where this exact code renders real
// web content on screen (first pixel + load events verified 2026-07).
// The standalone-library build of this project is still PENDING validation —
// see README "Build validation".
// ============================================================================

namespace winrt::ReactNativeWebViewWindows::implementation
{
    struct WebView2ComponentView
    {
        // Registers the "RNCWebView" Fabric view component. Called by this
        // package's ReactPackageProvider::CreatePackage; call it yourself only
        // if you bypass autolinking.
        static void RegisterViewComponent(
            winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) noexcept;

        // Optional: override the WebView2 user-data folder BEFORE the first
        // <WebView/> mounts (i.e., before the first CoreWebView2Environment is
        // created). Defaults to:
        //   packaged apps  : ApplicationData::Current().LocalFolder()\RNCWebViewWindows
        //   unpackaged apps: %LOCALAPPDATA%\RNCWebViewWindows (or %TEMP% fallback)
        // Use this to share a profile (cookies/session) with another WebView2
        // environment your app owns — the folder AND environment options must
        // match for WebView2 to share the browser process.
        static void SetUserDataFolder(std::wstring const &folder) noexcept;
    };
}
