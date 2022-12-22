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
    dispatch_async(dispatch_get_main_queue(), ^{
        [self initSDK];
        [Gleap setAutoActivationMethodsDisabled];
        [Gleap initializeWithToken: token];
    });
}

- (void)configLoaded:(NSDictionary *)config {
    // Hook up shake gesture recognizer.
    [[NSNotificationCenter defaultCenter] addObserver: self
                                                 selector: @selector(motionEnded:)
                                                     name: RCTShowDevMenuNotification
                                                object: nil];
    
    #if !RCT_DEV
        RCTSwapInstanceMethods([UIWindow class], @selector(motionEnded:withEvent:), @selector(handleShakeEvent:withEvent:));
    #endif

    // Add screenshot gesture recognizer
    NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];
        [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationUserDidTakeScreenshotNotification
                                                          object:nil
                                                           queue:mainQueue
                                                      usingBlock:^(NSNotification *note) {
        if ([Gleap isActivationMethodActive: SCREENSHOT]) {
            [Gleap open];
        }
    }];

    if ([Gleap getActivationMethods].count == 0) {
        NSMutableArray *activationMethods = [[NSMutableArray alloc] init];
        if ([config objectForKey: @"activationMethodShake"] != nil && [[config objectForKey: @"activationMethodShake"] boolValue] == YES) {
            [activationMethods addObject: @(SHAKE)];
        }
        if ([config objectForKey: @"activationMethodScreenshotGesture"] != nil && [[config objectForKey: @"activationMethodScreenshotGesture"] boolValue] == YES) {
            [activationMethods addObject: @(SCREENSHOT)];
        }
        
        [Gleap setActivationMethods: activationMethods];
    }
    
    if (_hasListeners) {
        [self sendEventWithName:@"configLoaded" body: config];
    }
}

- (void)motionEnded:(NSNotification *)notification
{
    if ([Gleap isActivationMethodActive: SHAKE]) {
        [Gleap open];
    }
}

- (void)feedbackSendingFailed {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackSendingFailed" body:@{}];
    }
}

- (void)widgetOpened {
    if (_hasListeners) {
        [self sendEventWithName:@"widgetOpened" body:@{}];
    }
}

- (void)widgetClosed {
    if (_hasListeners) {
        [self sendEventWithName:@"widgetClosed" body:@{}];
    }
}

- (void)feedbackSent:(NSDictionary *)data {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackSent" body: data];
    }
}

- (void)customActionCalled:(NSString *)customAction {
    if (_hasListeners) {
        [self sendEventWithName:@"customActionTriggered" body:@{
            @"name": customAction
        }];
    }
}

- (void)feedbackFlowStarted:(NSDictionary *)feedbackAction {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackFlowStarted" body: feedbackAction];
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
    return @[@"feedbackSent", @"feedbackSendingFailed", @"configLoaded", @"customActionTriggered", @"feedbackFlowStarted", @"widgetOpened", @"widgetClosed"];
}

RCT_EXPORT_METHOD(sendSilentCrashReport:(NSString *)description andSeverity:(NSString *)severity)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        GleapBugSeverity prio = MEDIUM;
        if ([severity isEqualToString: @"LOW"]) {
            prio = LOW;
        }
        if ([severity isEqualToString: @"HIGH"]) {
            prio = HIGH;
        }
        
        [Gleap sendSilentCrashReportWith: description andSeverity: prio andDataExclusion: nil andCompletion:^(bool success) {}];
    });
}

RCT_EXPORT_METHOD(sendSilentCrashReportWithExcludeData:(NSString *)description andSeverity:(NSString *)severity andExcludeData:(NSDictionary *)excludeData)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        GleapBugSeverity prio = MEDIUM;
        if ([severity isEqualToString: @"LOW"]) {
            prio = LOW;
        }
        if ([severity isEqualToString: @"HIGH"]) {
            prio = HIGH;
        }
        
        [Gleap sendSilentCrashReportWith: description andSeverity: prio andDataExclusion: excludeData andCompletion:^(bool success) {}];
    });
}

RCT_EXPORT_METHOD(attachNetworkLog:(NSArray *)networkLogs)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap attachExternalData: @{ @"networkLogs": networkLogs }];
    });
}

RCT_EXPORT_METHOD(setActivationMethods:(NSArray *)activationMethods)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        NSMutableArray *internalActivationMethods = [[NSMutableArray alloc] init];
        for (int i = 0; i < activationMethods.count; i++) {
            if ([[activationMethods objectAtIndex: i] isEqualToString: @"SHAKE"]) {
                [internalActivationMethods addObject: @(SHAKE)];
            }
            if ([[activationMethods objectAtIndex: i] isEqualToString: @"SCREENSHOT"]) {
                [internalActivationMethods addObject: @(SCREENSHOT)];
            }
        }
        
        [Gleap setActivationMethods: internalActivationMethods];
    });
}

RCT_EXPORT_METHOD(startFeedbackFlow:(NSString *)feedbackFlow andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startFeedbackFlow: feedbackFlow showBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(logWithLogLevel:(NSString *)message andLogLevel:(NSString *)logLevel)
{
    GleapLogLevel logLevelType = INFO;
    if (logLevel != nil && [logLevel isEqualToString: @"WARNING"]) {
        logLevelType = WARNING;
    }
    if (logLevel != nil && [logLevel isEqualToString: @"ERROR"]) {
        logLevelType = ERROR;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap log: message withLogLevel: logLevelType];
    });
}

RCT_EXPORT_METHOD(log:(NSString *)message)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap log: message];
    });
}

RCT_EXPORT_METHOD(disableConsoleLog)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap disableConsoleLog];
    });
}

RCT_EXPORT_METHOD(enableDebugConsoleLog)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap enableDebugConsoleLog];
    });
}

RCT_EXPORT_METHOD(open)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap open];
    });
}

RCT_EXPORT_METHOD(openNews: (BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openNews: showBackButton];
    });
}

RCT_EXPORT_METHOD(openNewsArticle: (NSString *)articleId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openNewsArticle: articleId andShowBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(openHelpCenterCollection: (NSString *)collectionId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openHelpCenterCollection: collectionId andShowBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(openHelpCenterArticle: (NSString *)articleId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openHelpCenterArticle: articleId andShowBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(searchHelpCenter: (NSString *)term andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap searchHelpCenter: term andShowBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(openHelpCenter: (BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openHelpCenter: showBackButton];
    });
}

RCT_EXPORT_METHOD(openFeatureRequests: (BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openFeatureRequests: showBackButton];
    });
}

RCT_EXPORT_METHOD(close)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap close];
    });
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)language)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setLanguage: language];
    });
}

RCT_EXPORT_METHOD(clearIdentity)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap clearIdentity];
    });
}

RCT_EXPORT_METHOD(getIdentity:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        NSDictionary * userIdentity = [Gleap getIdentity];
        resolve(userIdentity);
    });
}

RCT_EXPORT_METHOD(isOpened:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@([Gleap isOpened]));
    });
}

RCT_EXPORT_METHOD(isUserIdentified:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        BOOL isUserIdentified = [Gleap isUserIdentified];
        resolve(@(isUserIdentified));
    });
}

RCT_EXPORT_METHOD(identifyWithUserHash:(NSString *)userId withUserProperties: (NSDictionary *)userProperties andUserHash:(NSString *)userHash)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        GleapUserProperty *userProperty = [[GleapUserProperty alloc] init];
        if (userProperties != nil && [userProperties objectForKey: @"name"] != nil) {
            userProperty.name = [userProperties objectForKey: @"name"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"email"] != nil) {
            userProperty.email = [userProperties objectForKey: @"email"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"phone"] != nil) {
            userProperty.phone = [userProperties objectForKey: @"phone"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"value"] != nil) {
            userProperty.value = [userProperties objectForKey: @"value"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"customData"] != nil) {
            userProperty.customData = [userProperties objectForKey: @"customData"];
        }
        [Gleap identifyUserWith: userId andData: userProperty andUserHash: userHash];
    });
}

RCT_EXPORT_METHOD(identify:(NSString *)userId withUserProperties: (NSDictionary *)userProperties)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        GleapUserProperty *userProperty = [[GleapUserProperty alloc] init];
        if (userProperties != nil && [userProperties objectForKey: @"name"] != nil) {
            userProperty.name = [userProperties objectForKey: @"name"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"email"] != nil) {
            userProperty.email = [userProperties objectForKey: @"email"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"phone"] != nil) {
            userProperty.phone = [userProperties objectForKey: @"phone"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"value"] != nil) {
            userProperty.value = [userProperties objectForKey: @"value"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"customData"] != nil) {
            userProperty.customData = [userProperties objectForKey: @"customData"];
        }
        [Gleap identifyUserWith: userId andData: userProperty];
    });
}

RCT_EXPORT_METHOD(preFillForm:(NSDictionary *)formData)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap preFillForm: formData];
    });
}

RCT_EXPORT_METHOD(attachCustomData:(NSDictionary *)customData)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap attachCustomData: customData];
    });
}

RCT_EXPORT_METHOD(setCustomData:(NSString *)key andData:(NSString *)value)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setCustomData: value forKey: key];
    });
}

RCT_EXPORT_METHOD(removeCustomDataForKey:(NSString *)key)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap removeCustomDataForKey: key];
    });
}

RCT_EXPORT_METHOD(clearCustomData)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap clearCustomData];
    });
}

RCT_EXPORT_METHOD(setApiUrl: (NSString *)apiUrl)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setApiUrl: apiUrl];
    });
}

RCT_EXPORT_METHOD(setFrameUrl: (NSString *)frameUrl)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setFrameUrl: frameUrl];
    });
}

RCT_EXPORT_METHOD(showFeedbackButton: (BOOL)show)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap showFeedbackButton: show];
    });
}

RCT_EXPORT_METHOD(trackPage:(NSString *)pageName)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap trackEvent: @"pageView" withData: @{
            @"page": pageName
        }];
    });
}

RCT_EXPORT_METHOD(trackEvent:(NSString *)name andData:(NSDictionary *)data)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap trackEvent: name withData: data];
    });
}

RCT_EXPORT_METHOD(removeAllAttachments)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap removeAllAttachments];
    });
}

RCT_EXPORT_METHOD(addAttachment:(NSString *)base64file withFileName:(NSString *)fileName)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        NSArray *dataParts = [base64file componentsSeparatedByString: @";base64,"];
        NSData *fileData = [[NSData alloc] initWithBase64EncodedString: [dataParts lastObject] options:0];
        if (fileData != nil) {
            [Gleap addAttachmentWithData: fileData andName: fileName];
        } else {
            NSLog(@"[Gleap]: Invalid base64 string passed.");
        }
    });
}

- (void)dealloc
{
    @try{
       [[NSNotificationCenter defaultCenter] removeObserver: self];
    } @catch(id anException) {}
}

@end

