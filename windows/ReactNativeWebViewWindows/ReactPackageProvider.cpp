#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "WebView2ComponentView.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::ReactNativeWebViewWindows::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  // Registers the RNCWebViewWindowsInfo availability probe (REACT_MODULE in
  // WebView2ComponentView.cpp).
  AddAttributedModules(packageBuilder, true);

  // Registers the "RNCWebView" Fabric view component (New Architecture only;
  // no-op + probe=false on old-arch hosts).
  try {
    WebView2ComponentView::RegisterViewComponent(packageBuilder);
  } catch (winrt::hresult_error const &) {
  } catch (std::exception const &) {
  } catch (...) {
  }
}

} // namespace winrt::ReactNativeWebViewWindows::implementation
