// Autolinking (react-native-windows CLI). Shape follows react-native-webview
// 15.0.0's react-native.config.js dependency block.
module.exports = {
  dependency: {
    platforms: {
      windows: {
        sourceDir: 'windows',
        solutionFile: 'ReactNativeWebViewWindows.sln',
        projects: [
          {
            projectFile: 'ReactNativeWebViewWindows/ReactNativeWebViewWindows.vcxproj',
            directDependency: true,
          },
        ],
      },
    },
  },
}
