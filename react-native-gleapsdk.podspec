require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Native Gleap iOS SDK, released together with this package.
gleap_ios_sdk_version = "19.1.0"

Pod::Spec.new do |s|
  s.name         = "react-native-gleapsdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/GleapSDK/ReactNative-SDK.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"

  s.dependency "React-Core"

  # The native SDK comes from Swift Package Manager: CocoaPods trunk is read-only
  # from 2026-12-02, so new Gleap versions are not published as pods any more.
  # spm_dependency is React Native's helper (react-native/scripts/react_native_pods.rb,
  # React Native 0.75+); it adds the package to the Pods project in
  # react_native_post_install.
  if defined?(spm_dependency)
    spm_dependency(s,
      url: "https://github.com/GleapSDK/Gleap-iOS-SDK.git",
      requirement: { kind: "exactVersion", version: gleap_ios_sdk_version },
      products: ["Gleap"]
    )
  else
    # React Native < 0.75 (or a Podfile without React Native's scripts, e.g. pod lib lint):
    # the Gleap pod from CocoaPods trunk. It only has versions released before 2026-12-02.
    Pod::UI.warn "react-native-gleapsdk: spm_dependency is not available (React Native < 0.75), " \
      "falling back to the Gleap #{gleap_ios_sdk_version} pod from CocoaPods trunk. " \
      "CocoaPods trunk gets no new Gleap versions after 2026-12-02; upgrade to React Native 0.75 or later."
    s.dependency "Gleap", gleap_ios_sdk_version
  end
end
