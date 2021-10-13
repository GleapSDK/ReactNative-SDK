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

RCT_EXPORT_METHOD(initialize:(NSString *)token)
{
    [self initSDK];
    [Gleap initializeWithToken: token];
}

- (void)configLoaded:(NSDictionary *)config {
    if ([config objectForKey: @"activationMethodShake"] != nil && [[config objectForKey: @"activationMethodShake"] boolValue] == YES) {
        [[NSNotificationCenter defaultCenter] addObserver: self
                                                     selector: @selector(motionEnded:)
                                                         name: RCTShowDevMenuNotification
                                                    object: nil];
        
        #if !RCT_DEV
            RCTSwapInstanceMethods([UIWindow class], @selector(motionEnded:withEvent:), @selector(handleShakeEvent:withEvent:));
        #endif
    }
    if ([config objectForKey: @"activationMethodScreenshotGesture"] != nil && [[config objectForKey: @"activationMethodScreenshotGesture"] boolValue] == YES) {
        NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];
            [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationUserDidTakeScreenshotNotification
                                                              object:nil
                                                               queue:mainQueue
                                                          usingBlock:^(NSNotification *note) {
                                                            [Gleap startFeedbackFlow];
                                                          }];
    }
    if ([config objectForKey: @"activationMethodThreeFingerDoubleTab"] != nil && [[config objectForKey: @"activationMethodThreeFingerDoubleTab"] boolValue] == YES) {
        [self initializeGestureRecognizer];
    }
    
    if (_hasListeners) {
        [self sendEventWithName:@"configLoaded" body: config];
    }
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

- (void)feedbackWillBeSent {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackWillBeSent" body:@{}];
    }
}

- (void)feedbackSendingFailed {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackSendingFailed" body:@{}];
    }
}

- (void)feedbackSent {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackSent" body:@{}];
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

- (NSArray<NSString *> *)supportedEvents {
    return @[@"feedbackSent", @"feedbackWillBeSent", @"feedbackSendingFailed", @"configLoaded", @"customActionTriggered"];
}

RCT_EXPORT_METHOD(sendSilentBugReport:(NSString *)description andPriority:(NSString *)priority)
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

RCT_EXPORT_METHOD(startFeedbackFlow)
{
    [Gleap startFeedbackFlow];
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)language)
{
    [Gleap setLanguage: language];
}

RCT_EXPORT_METHOD(clearIdentity)
{
    [Gleap clearIdentity];
}

RCT_EXPORT_METHOD(userId:(NSString *)userId withUserProperties: (NSDictionary *)userProperties)
{
    GleapUserProperty *userProperty = [[GleapUserProperty alloc] init];
    if (userProperties != nil && [userProperties objectForKey: @"name"] != nil) {
        userProperty.name = [userProperties objectForKey: @"name"];
    }
    if (userProperties != nil && [userProperties objectForKey: @"email"] != nil) {
        userProperty.email = [userProperties objectForKey: @"email"];
    }
    [Gleap identifyUserWith: userId andData: userProperty];
}

RCT_EXPORT_METHOD(attachCustomData:(NSDictionary *)customData)
{
    [Gleap attachCustomData: customData];
}

RCT_EXPORT_METHOD(setCustomData:(NSString *)key andData:(NSString *)value)
{
    [Gleap setCustomData: value forKey: key];
}

RCT_EXPORT_METHOD(removeCustomDataForKey:(NSString *)key)
{
    [Gleap removeCustomDataForKey: key];
}

RCT_EXPORT_METHOD(clearCustomData)
{
    [Gleap clearCustomData];
}

RCT_EXPORT_METHOD(setApiUrl: (NSString *)apiUrl)
{
    [Gleap setApiUrl: apiUrl];
}

RCT_EXPORT_METHOD(setWidgetUrl: (NSString *)apiUrl)
{
    [Gleap setWidgetUrl: apiUrl];
}

RCT_EXPORT_METHOD(removeAllAttachments)
{
    [Gleap removeAllAttachments];
}

RCT_EXPORT_METHOD(logEvent:(NSString *)name andData:(NSDictionary *)data)
{
    [Gleap logEvent: name withData: data];
}

@end
