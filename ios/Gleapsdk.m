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
        [Gleap trackEvent: @"pageView" withData: @{
            @"page": @"MainPage"
        }];
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

- (void)initialized {
    if (_hasListeners) {
        [self sendEventWithName:@"initialized" body: @{}];
    }
}

- (void)motionEnded:(NSNotification *)notification
{
    if ([Gleap isActivationMethodActive: SHAKE]) {
        [Gleap open];
    }
}

- (void)notificationCountUpdated:(NSInteger)count {
    if (_hasListeners) {
        [self sendEventWithName:@"notificationCountUpdated" body: @(count)];
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

- (void)registerPushMessageGroup:(NSString *)pushMessageGroup {
    if (_hasListeners) {
        [self sendEventWithName:@"registerPushMessageGroup" body: pushMessageGroup];
    }
}

- (void)unregisterPushMessageGroup:(NSString *)pushMessageGroup {
    if (_hasListeners) {
        [self sendEventWithName:@"unregisterPushMessageGroup" body: pushMessageGroup];
    }
}

- (void)onToolExecution:(NSDictionary *)toolExecution {
    if (_hasListeners) {
        [self sendEventWithName:@"toolExecution" body: toolExecution];
    }
}

- (void)feedbackSent:(NSDictionary *)data {
    if (_hasListeners) {
        [self sendEventWithName:@"feedbackSent" body: data];
    }
}

- (void)outboundSent:(NSDictionary *)data {
    if (_hasListeners) {
        [self sendEventWithName:@"outboundSent" body: data];
    }
}

- (void)customActionCalled:(NSString *)customAction withShareToken:(NSString *)shareToken {
    if (!_hasListeners) { return; }

    [self sendEventWithName:@"customActionTriggered"
        body:@{
            @"name":       customAction ?: @"",
            @"shareToken": shareToken   ?: @""
        }
    ];
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
    return @[@"feedbackSent", @"outboundSent", @"toolExecution", @"feedbackSendingFailed", @"notificationCountUpdated", @"initialized", @"configLoaded", @"customActionTriggered", @"feedbackFlowStarted", @"widgetOpened", @"widgetClosed", @"registerPushMessageGroup", @"unregisterPushMessageGroup"];
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

RCT_EXPORT_METHOD(setTags:(NSArray *)tags)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setTags: tags];
    });
}

RCT_EXPORT_METHOD(setNetworkLogsBlacklist:(NSArray *)networkLogBlacklist)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setNetworkLogsBlacklist: networkLogBlacklist];
    });
}

RCT_EXPORT_METHOD(setNetworkLogPropsToIgnore:(NSArray *)networkLogPropsToIgnore)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setNetworkLogPropsToIgnore: networkLogPropsToIgnore];
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

RCT_EXPORT_METHOD(startBot:(NSString *)botId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startBot: botId showBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(openConversations:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openConversations: showBackButton];
    });
}

RCT_EXPORT_METHOD(openConversation:(NSString *)shareToken)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openConversation: shareToken];
    });
}

RCT_EXPORT_METHOD(startConversation:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startConversation: showBackButton];
    });
}

RCT_EXPORT_METHOD(startFeedbackFlow:(NSString *)feedbackFlow andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startFeedbackFlow: feedbackFlow showBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(startClassicForm:(NSString *)formId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startClassicForm: formId showBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(showSurvey:(NSString *)surveyId andFormat:(NSString *)format)
{
    GleapSurveyFormat surveyFormat = SURVEY;
    if (format != nil && [format isEqualToString: @"survey_full"]) {
        surveyFormat = SURVEY_FULL;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap showSurvey: surveyId andFormat: surveyFormat];
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

RCT_EXPORT_METHOD(setDisableInAppNotifications: (BOOL)disableInAppNotifications)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setDisableInAppNotifications: disableInAppNotifications];
    });
}

RCT_EXPORT_METHOD(openChecklists: (BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openChecklists: showBackButton];
    });
}

RCT_EXPORT_METHOD(openChecklist: (NSString *)checklistId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap openChecklist: checklistId andShowBackButton: showBackButton];
    });
}

RCT_EXPORT_METHOD(startChecklist: (NSString *)outboundId andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap startChecklist: outboundId andShowBackButton: showBackButton];
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

RCT_EXPORT_METHOD(askAI: (NSString *)question andShowBackButton:(BOOL)showBackButton)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap askAI: question andShowBackButton: showBackButton];
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

RCT_EXPORT_METHOD(updateContact: (NSDictionary *)userProperties)
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
        if (userProperties != nil && [userProperties objectForKey: @"sla"] != nil) {
            userProperty.sla = [userProperties objectForKey: @"sla"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"plan"] != nil) {
            userProperty.plan = [userProperties objectForKey: @"plan"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyName"] != nil) {
            userProperty.companyName = [userProperties objectForKey: @"companyName"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyId"] != nil) {
            userProperty.companyId = [userProperties objectForKey: @"companyId"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"avatar"] != nil) {
            userProperty.avatar = [userProperties objectForKey: @"avatar"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"customData"] != nil) {
            userProperty.customData = [userProperties objectForKey: @"customData"];
        }
        [Gleap updateContact: userProperty];
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
        if (userProperties != nil && [userProperties objectForKey: @"plan"] != nil) {
            userProperty.plan = [userProperties objectForKey: @"plan"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"sla"] != nil) {
            userProperty.sla = [userProperties objectForKey: @"sla"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyName"] != nil) {
            userProperty.companyName = [userProperties objectForKey: @"companyName"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyId"] != nil) {
            userProperty.companyId = [userProperties objectForKey: @"companyId"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"avatar"] != nil) {
            userProperty.avatar = [userProperties objectForKey: @"avatar"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"customData"] != nil) {
            userProperty.customData = [userProperties objectForKey: @"customData"];
        }
        [Gleap identifyContact: userId andData: userProperty andUserHash: userHash];
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
        if (userProperties != nil && [userProperties objectForKey: @"sla"] != nil) {
            userProperty.sla = [userProperties objectForKey: @"sla"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"plan"] != nil) {
            userProperty.plan = [userProperties objectForKey: @"plan"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyName"] != nil) {
            userProperty.companyName = [userProperties objectForKey: @"companyName"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"companyId"] != nil) {
            userProperty.companyId = [userProperties objectForKey: @"companyId"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"avatar"] != nil) {
            userProperty.avatar = [userProperties objectForKey: @"avatar"];
        }
        if (userProperties != nil && [userProperties objectForKey: @"customData"] != nil) {
            userProperty.customData = [userProperties objectForKey: @"customData"];
        }
        [Gleap identifyContact: userId andData: userProperty];
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

RCT_EXPORT_METHOD(setTicketAttribute:(NSString *)key andValue:(NSString *)value)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap setTicketAttributeWithKey: key value: value];
    });
}

RCT_EXPORT_METHOD(unsetTicketAttribute:(NSString *)key) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap unsetTicketAttributeWithKey: key];
    });
}

RCT_EXPORT_METHOD(clearTicketAttributes) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Gleap clearTicketAttributes];
    });
}

RCT_EXPORT_METHOD(setAiTools:(NSArray *)toolsArray) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            NSMutableArray *aiTools = [[NSMutableArray alloc] init];

            for (NSDictionary *toolDict in toolsArray) {
                // Safely unwrap tool dictionary properties
                NSString *name = toolDict[@"name"];
                NSString *toolDescription = toolDict[@"description"];
                NSString *response = toolDict[@"response"];
                NSString *executionType = toolDict[@"executionType"];
                NSArray *parametersArray = toolDict[@"parameters"];
                
                if (name && toolDescription && response && parametersArray) {
                    NSMutableArray *parameters = [[NSMutableArray alloc] init];

                    for (NSDictionary *paramDict in parametersArray) {
                        // Safely unwrap parameter dictionary properties
                        NSString *paramName = paramDict[@"name"];
                        NSString *paramDescription = paramDict[@"description"];
                        NSString *type = paramDict[@"type"];
                        NSNumber *required = paramDict[@"required"];
                        NSArray *enums = paramDict[@"enum"];
                        if (enums == nil) {
                            enums = [[NSArray alloc] init];
                        }

                        // Check for required properties in parameter dictionary
                        if (paramName && paramDescription && type && required) {
                            GleapAiToolParameter *parameter = [[GleapAiToolParameter alloc]
                                initWithName:paramName
                                parameterDescription:paramDescription
                                type:type
                                required:[required boolValue]
                                enums:enums];
                            
                            [parameters addObject:parameter];
                        }
                    }

                    GleapAiTool *aiTool = [[GleapAiTool alloc]
                        initWithName:name
                        toolDescription:toolDescription
                        response:response
                        executionType:executionType
                        parameters:parameters];

                    [aiTools addObject:aiTool];
                }
            }

            [Gleap setAiTools:aiTools];
        } @catch (NSException *exception) {
            
        }
    });
}

RCT_EXPORT_METHOD(setCustomData:(NSString *)key andValue:(NSString *)value)
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

