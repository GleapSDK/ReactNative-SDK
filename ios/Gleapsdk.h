#import <React/RCTBridgeModule.h>
#import <Gleap/Gleap.h>
#import <React/RCTEventEmitter.h>

// Check if TurboModules are available (React Native version 0.68+)
#if __has_include(<ReactCommon/TurboModule.h>)
#import <ReactCommon/TurboModule.h>
#import <ReactCommon/RCTTurboModuleManager.h>
@interface Gleapsdk : RCTEventEmitter <RCTBridgeModule, GleapDelegate, TurboModule>
#else
@interface Gleapsdk : RCTEventEmitter <RCTBridgeModule, GleapDelegate>
#endif

@end
