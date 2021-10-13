#import <React/RCTBridgeModule.h>
#import <Gleap/Gleap.h>
#import <React/RCTEventEmitter.h>

@interface Gleapsdk : RCTEventEmitter <RCTBridgeModule, GleapDelegate>

@end
