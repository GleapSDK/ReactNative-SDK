#import "Gleapsdk.h"

#import <React/RCTEventDispatcher.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

static NSString *const RCTShowDevMenuNotification = @"RCTShowDevMenuNotification";

#if !RCT_DEV

@implementation UIWindow (RNShakeEvent)

- (void)handleShakeEvent:(__unused UIEventSubtype)motion withEvent:(UIEvent *)event
{
    if (event.subtype == UIEventSubtypeMotionShake) {
        [[NSNotificationCenter defaultCenter] postNotificationName: RCTShowDevMenuNotification object:nil];
    }
}

@end

#endif

@implementation Gleapsdk
{
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE()

- (void)initSDK {
    Gleap.sharedInstance.delegate = self;
    [Gleap setApplicationType: REACTNATIVE];
}

RCT_EXPORT_METHOD(initialize:(NSString *)token andActivationMethod:(NSString *)activationMethod)
{
    // Initialize the SDK
    if ([activationMethod isEqualToString: @"SCREENSHOT"]) {
        [[Gleap sharedInstance] setActivationMethods: @[@(SCREENSHOT)]];
    }
    
    if ([activationMethod isEqualToString: @"SHAKE"]) {
        [[NSNotificationCenter defaultCenter] addObserver: self
                                                     selector: @selector(motionEnded:)
                                                         name: RCTShowDevMenuNotification
                                                    object: nil];
        
        #if !RCT_DEV
            RCTSwapInstanceMethods([UIWindow class], @selector(motionEnded:withEvent:), @selector(handleShakeEvent:withEvent:));
        #endif
    }
    
    if ([activationMethod isEqualToString: @"THREE_FINGER_DOUBLE_TAB"]) {
        [self initializeGestureRecognizer];
    }
    
    [self initSDK];
}

RCT_EXPORT_METHOD(initializeMany:(NSString *)token andActivationMethods:(NSArray *)activationMethods)
{
    // Initialize the SDK
    if ([self activationMethods: activationMethods contain: @"SCREENSHOT"]) {
        [[Gleap sharedInstance] setActivationMethods: @[@(SCREENSHOT)]];
    }
    
    if ([self activationMethods: activationMethods contain: @"SHAKE"]) {
        [[NSNotificationCenter defaultCenter] addObserver: self
                                                     selector: @selector(motionEnded:)
                                                         name: RCTShowDevMenuNotification
                                                    object: nil];
        
        #if !RCT_DEV
            RCTSwapInstanceMethods([UIWindow class], @selector(motionEnded:withEvent:), @selector(handleShakeEvent:withEvent:));
        #endif
    }
    
    if ([self activationMethods: activationMethods contain: @"THREE_FINGER_DOUBLE_TAB"]) {
        [self initializeGestureRecognizer];
    }

    [self initSDK];
}

- (BOOL)activationMethods: (NSArray *)activationMethods contain: (NSString *)activationMethod {
    for (int i = 0; i < activationMethods.count; i++) {
        if ([activationMethod isEqualToString: [activationMethods objectAtIndex: i]]) {
            return true;
        }
    }
    return false;
}

- (void)initializeGestureRecognizer {
    UITapGestureRecognizer *tapGestureRecognizer = [[UITapGestureRecognizer alloc] initWithTarget: self action: @selector(handleTapGestureActivation:)];
    tapGestureRecognizer.numberOfTapsRequired = 2;
    tapGestureRecognizer.numberOfTouchesRequired = 3;
    tapGestureRecognizer.cancelsTouchesInView = false;
    
    [[[[UIApplication sharedApplication] delegate] window] addGestureRecognizer: tapGestureRecognizer];
}

- (void)handleTapGestureActivation: (UITapGestureRecognizer *)recognizer
{
    [Gleap startFeedbackFlow];
}

- (void)motionEnded:(NSNotification *)notification
{
    [Gleap startFeedbackFlow];
}

- (void)bugWillBeSent {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackWillBeSent" body:@{}];
    }
}

- (void)customActionCalled:(NSString *)customAction {
    if (_hasListeners) {
        [self sendEventWithName:@"customActionTriggered" body:@{
            @"name": customAction
        }];
    }
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

-(UIColor *)colorFromHexString:(NSString *)hexString {
    unsigned rgbValue = 0;
    NSScanner *scanner = [NSScanner scannerWithString:hexString];
    [scanner setScanLocation:1];
    [scanner scanHexInt:&rgbValue];
    return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0 green:((rgbValue & 0xFF00) >> 8)/255.0 blue:(rgbValue & 0xFF)/255.0 alpha:1.0];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"bugWillBeSent", @"customActionTriggered"];
}

RCT_EXPORT_METHOD(sendSilentBugReportWith:(NSString *)description andPriority:(NSString *)priority)
{
    GleapBugSeverity prio = MEDIUM;
    if ([priority isEqualToString: @"LOW"]) {
        prio = LOW;
    }
    if ([priority isEqualToString: @"HIGH"]) {
        prio = HIGH;
    }
    [Gleap sendSilentBugReportWith: description andPriority: prio];
}

RCT_EXPORT_METHOD(attachNetworkLog:(NSArray *)networkLogs)
{
    [Gleap attachData: @{ @"networkLogs": networkLogs }];
}

RCT_EXPORT_METHOD(startBugReporting)
{
    [Gleap startFeedbackFlow];
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)language)
{
    [Gleap setLanguage: language];
}

RCT_EXPORT_METHOD(attachCustomData:(NSDictionary *)customData)
{
    [Gleap attachCustomData: customData];
}

RCT_EXPORT_METHOD(setCustomData:(NSString *)key andData:(NSString *)value)
{
    [Gleap setCustomData: value forKey: key];
}

RCT_EXPORT_METHOD(removeCustomData:(NSString *)key)
{
    [Gleap removeCustomDataForKey: key];
}

RCT_EXPORT_METHOD(clearCustomData)
{
    [Gleap clearCustomData];
}

RCT_EXPORT_METHOD(enableReplays:(BOOL)enable)
{
    [Gleap enableReplays: enable];
}

RCT_EXPORT_METHOD(setApiUrl: (NSString *)apiUrl)
{
    [Gleap setApiUrl: apiUrl];
}

RCT_EXPORT_METHOD(logEvent:(NSString *)name andData:(NSDictionary *)data)
{
    [Gleap logEvent: name withData: data];
}

@end
