#import <React/RCTBridgeModule.h>
#if __has_include(<Gleap/Gleap.h>)
// Gleap pod from CocoaPods trunk (React Native < 0.75 fallback in the podspec).
#import <Gleap/Gleap.h>
#else
// Gleap Swift package (spm_dependency): its headers are the module Gleap, not a Gleap/ folder.
@import Gleap;
#endif
#import <React/RCTEventEmitter.h>

@interface Gleapsdk : RCTEventEmitter <RCTBridgeModule, GleapDelegate>

@end
