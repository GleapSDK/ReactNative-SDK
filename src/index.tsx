import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import GleapNetworkIntercepter from './networklogger';

const LINKING_ERROR =
  `The package 'react-native-gleapsdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

export type GleapUserProperty = {
  email?: string;
  name?: string;
  phone?: string;
  value?: number;
  sla?: number;
  plan?: string;
  companyName?: string;
  companyId?: string;
  avatar?: string;
  customData?: { [key: string]: string | number };
};

type GleapActivationMethod = 'SHAKE' | 'SCREENSHOT';

type GleapSdkType = {
  initialize(token: string): void;
  startFeedbackFlow(feedbackFlow: string, showBackButton: boolean): void;
  startBot(botId: string, showBackButton: boolean): void;
  sendSilentCrashReport(
    description: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
  ): void;
  sendSilentCrashReportWithExcludeData(
    description: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH',
    excludeData: {
      customData?: Boolean;
      metaData?: Boolean;
      attachments?: Boolean;
      consoleLog?: Boolean;
      networkLogs?: Boolean;
      customEventLog?: Boolean;
      screenshot?: Boolean;
      replays?: Boolean;
    }
  ): void;
  openConversations(showBackButton: boolean): void;
  openConversation(shareToken: string): void;
  /**
   * Handles a tapped Gleap push notification. Pass the FCM message's `data`
   * payload (e.g. `remoteMessage.data`) after checking
   * `data.sender === 'GLEAP'`. Opens the right destination based on
   * `data.type` ('conversation' | 'news' | 'checklist') and `data.id`, and
   * safely defers until the Gleap session is ready (cold starts).
   */
  handlePushNotification(notificationData: { [key: string]: any }): void;
  startConversation(showBackButton: boolean): void;
  startClassicForm(formId: string, showBackButton: boolean): void;
  open(): void;
  openNews(showBackButton: boolean): void;
  openNewsArticle(articleId: string, showBackButton: boolean): void;
  openChecklists(showBackButton: boolean): void;
  openChecklist(checklistId: string, showBackButton: boolean): void;
  startChecklist(outboundId: string, showBackButton: boolean): void;
  openFeatureRequests(showBackButton: boolean): void;
  openHelpCenter(showBackButton: boolean): void;
  openHelpCenterCollection(collectionId: string, showBackButton: boolean): void;
  openHelpCenterArticle(articleId: string, showBackButton: boolean): void;
  askAI(question: string, showBackButton: boolean): void;
  searchHelpCenter(term: string, showBackButton: boolean): void;
  close(): void;
  isOpened(): Promise<boolean>;
  identify(userId: string, userProperties: GleapUserProperty): void;
  identifyWithUserHash(
    userId: string,
    userProperties: GleapUserProperty,
    userHash: string
  ): void;
  updateContact(userProperties: GleapUserProperty): void;
  showFeedbackButton(show: boolean): void;
  clearIdentity(): void;
  preFillForm(formData: { [key: string]: string }): void;
  /**
   * Leaves requests whose URL contains one of the given strings out of the
   * network logs (gleap.io and gleap.ai are always left out). Each call
   * replaces the previous list.
   */
  setNetworkLogsBlacklist(networkLogBlacklist: string[]): void;
  /**
   * Removes headers, JSON keys (at any depth; `user.password` also works as a
   * path), form fields and query parameters with these names from the
   * network logs, case-insensitively. Authorization, Proxy-Authorization,
   * Cookie and Set-Cookie headers are always masked. Each call replaces the
   * previous list.
   */
  setNetworkLogPropsToIgnore(networkLogPropsToIgnore: string[]): void;
  /**
   * Removes the given env data keys (exact and case-sensitive, e.g.
   * 'deviceName', 'batteryLevel') from tickets and conversations before they
   * leave the device. Each call replaces the previous list; an empty list
   * resets it. Can be called before or after initialize and applies to the
   * next ticket.
   */
  setEnvDataPropsToIgnore(envDataPropsToIgnore: string[]): void;
  /**
   * Sets the data region of your Gleap project. Sets the API url, the
   * websocket url and the realtime host at once. Must be called before
   * initialize. A manual setter (setApiUrl, setWSApiUrl, setRealtimeHost)
   * called after setRegion overrides that single host. The static widget
   * hosts (frame, banner, modal) are global and not changed by the region.
   */
  setRegion(region: 'eu' | 'us'): void;
  setApiUrl(apiUrl: string): void;
  setWSApiUrl(wsApiUrl: string): void;
  setRealtimeHost(host: string): void;
  setFrameUrl(frameUrl: string): void;
  setBannerUrl(url: string): void;
  setModalUrl(url: string): void;
  attachCustomData(customData: any): void;
  setCustomData(key: string, value: string): void;
  removeCustomDataForKey(key: string): void;
  clearCustomData(): void;
  setDisableInAppNotifications(disableInAppNotifications: boolean): void;
  /**
   * Stops the SDK from collecting env data (device name, OS, screen size,
   * locale, battery, ...) when set to true: tickets and conversations are
   * sent with an empty metaData object. Pass false to collect it again. Can
   * be called before or after initialize and applies to the next ticket.
   */
  setDisableEnvData(disableEnvData: boolean): void;
  /**
   * Sets the color scheme of the Gleap widget and overrides the color scheme
   * configured in the Gleap dashboard. Only takes effect when "Adapt to dark /
   * light mode" is enabled in the dashboard; otherwise the widget always keeps
   * its normal colors. Before the first call the dashboard setting applies.
   * 'auto' follows the device appearance (dark/light mode). Apps with their
   * own in-app theme toggle should pass 'light' / 'dark' explicitly (e.g.
   * from useColorScheme() or the app's theme state) and call it again
   * whenever the theme changes.
   * In dark mode the widget uses the dark mode colors, logo, header image and
   * composer glow set in the Gleap dashboard; without dark colors it keeps
   * its normal colors. lightBackgroundColor / darkBackgroundColor (#rrggbb)
   * override the background in light / dark mode. Can be called before or
   * after initialize and applies live.
   */
  setColorScheme(
    colorScheme: 'auto' | 'light' | 'dark',
    options?: {
      lightBackgroundColor?: string;
      darkBackgroundColor?: string;
    }
  ): void;
  setNotificationContainerOffset(x: number, y: number): void;
  registerListener(eventType: string, callback: (data?: any) => void): void;
  setLanguage(language: string): void;
  enableDebugConsoleLog(): void;
  disableConsoleLog(): void;
  setTags(tags: string[]): void;
  trackPage(pageName: String): void;
  showSurvey(surveyId: String, format: 'survey' | 'survey_full'): void;
  log(message: string): void;
  logWithLogLevel(
    message: string,
    logLevel: 'INFO' | 'WARNING' | 'ERROR'
  ): void;
  logEvent(name: string, data: any): void;
  trackEvent(name: string, data: any): void;
  addAttachment(base64file: string, fileName: string): void;
  removeAllAttachments(): void;
  startNetworkLogging(): void;
  stopNetworkLogging(): void;
  setActivationMethods(activationMethods: GleapActivationMethod[]): void;
  registerCustomAction(
    customActionCallback: (data: { name: string; shareToken?: string }) => void
  ): void;
  getIdentity(): Promise<any>;
  isUserIdentified(): Promise<boolean>;
  setTicketAttribute(key: string, value: string): void;
  unsetTicketAttribute(key: string): void;
  clearTicketAttributes(): void;
  /**
   * Registers the handler for a Frontend tool defined on your AI agent in the
   * Gleap dashboard. The agent calls the handler with the configured
   * parameters and waits for the returned result (string or object, which
   * gets stringified).
   */
  registerAgentTool(
    name: string,
    handler: (params: Record<string, any>) => any | Promise<any>
  ): void;
};

const GleapSdk = NativeModules.Gleapsdk
  ? NativeModules.Gleapsdk
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

if (GleapSdk && !GleapSdk.touched) {
  // iOS: the native SDK logs every NSURLSession request, React Native's
  // networking included, so a JS interceptor would log each request twice.
  // Android: React Native's OkHttp client is not instrumented natively, so
  // the JS interceptor logs fetch / XMLHttpRequest and hands the list over.
  const logsNetworkInJs = Platform.OS === 'android';
  const networkLogger = new GleapNetworkIntercepter();
  let networkLoggingStoppedByApp = false;

  const setNativeNetworkRecording = (enabled: boolean) => {
    if (enabled && typeof GleapSdk.startNetworkRecording === 'function') {
      GleapSdk.startNetworkRecording();
    }
    if (!enabled && typeof GleapSdk.stopNetworkRecording === 'function') {
      GleapSdk.stopNetworkRecording();
    }
  };

  GleapSdk.startNetworkLogging = () => {
    networkLoggingStoppedByApp = false;
    if (logsNetworkInJs) {
      networkLogger.start();
    } else {
      setNativeNetworkRecording(true);
    }
  };

  GleapSdk.stopNetworkLogging = () => {
    networkLoggingStoppedByApp = true;
    if (logsNetworkInJs) {
      networkLogger.setStopped(true);
    } else {
      setNativeNetworkRecording(false);
    }
  };

  if (logsNetworkInJs) {
    // Hands the full, redacted list of finished requests to the native SDK
    // (replace semantics). The logger calls this at most every 500 ms.
    networkLogger.setUpdatedCallback((networkLogs) => {
      if (typeof GleapSdk.attachNetworkLog === 'function') {
        GleapSdk.attachNetworkLog(JSON.stringify(networkLogs));
      }
    });

    // The JS logger keeps a copy of both lists to redact before the
    // hand-off; the native SDK still gets them.
    const nativeSetNetworkLogsBlacklist = GleapSdk.setNetworkLogsBlacklist;
    GleapSdk.setNetworkLogsBlacklist = (networkLogBlacklist: string[]) => {
      networkLogger.setBlacklist(networkLogBlacklist);
      if (typeof nativeSetNetworkLogsBlacklist === 'function') {
        nativeSetNetworkLogsBlacklist(networkLogBlacklist);
      }
    };

    const nativeSetNetworkLogPropsToIgnore =
      GleapSdk.setNetworkLogPropsToIgnore;
    GleapSdk.setNetworkLogPropsToIgnore = (
      networkLogPropsToIgnore: string[]
    ) => {
      networkLogger.setPropsToIgnore(networkLogPropsToIgnore);
      if (typeof nativeSetNetworkLogPropsToIgnore === 'function') {
        nativeSetNetworkLogPropsToIgnore(networkLogPropsToIgnore);
      }
    };

    // Silent crash reports are built right away, so hand over the latest
    // network logs first instead of waiting for the next scheduled push.
    const nativeSendSilentCrashReport = GleapSdk.sendSilentCrashReport;
    if (typeof nativeSendSilentCrashReport === 'function') {
      GleapSdk.sendSilentCrashReport = (
        description: string,
        severity: string
      ) => {
        networkLogger.flush();
        nativeSendSilentCrashReport(description, severity);
      };
    }

    const nativeSendSilentCrashReportWithExcludeData =
      GleapSdk.sendSilentCrashReportWithExcludeData;
    if (typeof nativeSendSilentCrashReportWithExcludeData === 'function') {
      GleapSdk.sendSilentCrashReportWithExcludeData = (
        description: string,
        severity: string,
        excludeData: any
      ) => {
        networkLogger.flush();
        nativeSendSilentCrashReportWithExcludeData(
          description,
          severity,
          excludeData
        );
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  GleapSdk.logEvent = (name: string, data: any) => {
    console.log('logEvent is deprecated. Use trackEvent instead.');
    GleapSdk.trackEvent(name, data);
  };

  var callbacks: any = {};

  GleapSdk.registerListener = (eventType: string, callback: any) => {
    if (!callbacks[eventType]) {
      callbacks[eventType] = [];
    }
    callbacks[eventType].push(callback);
  };

  GleapSdk.registerCustomAction = (customActionCallback: any) => {
    GleapSdk.registerListener('customActionTriggered', customActionCallback);
  };

  // The native method takes the colors as separate (nullable) arguments, so
  // the options object stays optional on the JS side.
  const nativeSetColorScheme = GleapSdk.setColorScheme;

  GleapSdk.setColorScheme = (
    colorScheme: 'auto' | 'light' | 'dark',
    options?: { lightBackgroundColor?: string; darkBackgroundColor?: string }
  ) => {
    nativeSetColorScheme(
      colorScheme,
      options?.lightBackgroundColor ?? null,
      options?.darkBackgroundColor ?? null
    );
  };

  const registeredAgentTools: {
    [name: string]: (params: Record<string, any>) => any;
  } = {};
  const nativeRegisterAgentTool = GleapSdk.registerAgentTool;

  GleapSdk.registerAgentTool = (
    name: string,
    handler: (params: Record<string, any>) => any
  ) => {
    if (!name || typeof handler !== 'function') {
      return;
    }
    registeredAgentTools[name] = handler;
    nativeRegisterAgentTool(name);
  };

  const notifyCallback = function (eventType: string, data?: any) {
    if (callbacks && callbacks[eventType] && callbacks[eventType].length > 0) {
      for (var i = 0; i < callbacks[eventType].length; i++) {
        if (callbacks[eventType][i]) {
          callbacks[eventType][i](data);
        }
      }
    }
  };

  const gleapEmitter = new NativeEventEmitter(NativeModules.Gleapsdk);

  // Android: the native module replays the loaded config when initialize is
  // called again (JS reload, SDK already initialized natively), so a config
  // can arrive twice; it is handled once per JS context.
  let configHandled = false;
  let initializedHandled = false;

  gleapEmitter.addListener('configLoaded', (config: any) => {
    try {
      const configJSON = config instanceof Object ? config : JSON.parse(config);
      if (Platform.OS === 'android') {
        if (configHandled) {
          return;
        }
        configHandled = true;
      }
      // An explicit stopNetworkLogging() wins over the remote config.
      if (logsNetworkInJs) {
        networkLogger.setRemoteConfig(configJSON);
        if (configJSON.enableNetworkLogs && !networkLoggingStoppedByApp) {
          networkLogger.start();
        }
      } else if (networkLoggingStoppedByApp) {
        // The native SDK starts recording itself when the config enables
        // network logs.
        setNativeNetworkRecording(false);
      }
      notifyCallback('configLoaded', configJSON);
    } catch (exp) {}
  });

  gleapEmitter.addListener('initialized', () => {
    try {
      if (Platform.OS === 'android') {
        if (initializedHandled) {
          return;
        }
        initializedHandled = true;
      }
      notifyCallback('initialized');
    } catch (exp) {}
  });

  gleapEmitter.addListener('toolExecution', (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('toolExecution', dataJSON);
    } catch (exp) {}
  });

  gleapEmitter.addListener('agentToolExecution', async (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      const { executionId, name, params } = dataJSON;
      if (!executionId || !name) {
        return;
      }

      let result;
      const handler = registeredAgentTools[name];
      if (!handler) {
        result = `No handler registered for tool '${name}' in the app. Register one via Gleap.registerAgentTool('${name}', handler).`;
      } else {
        try {
          const handlerResult = await handler(params ?? {});
          result =
            typeof handlerResult === 'string'
              ? handlerResult
              : JSON.stringify(handlerResult ?? '');
          if (!result) {
            result = 'The action completed without returning a result.';
          }
        } catch (error: any) {
          result = `Tool execution failed: ${
            error?.message ?? 'unknown error'
          }`;
        }
      }

      GleapSdk.sendAgentToolResult(executionId, result);
    } catch (exp) {}
  });

  gleapEmitter.addListener('feedbackSent', (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('feedbackSent', dataJSON);
    } catch (exp) {}
  });

  gleapEmitter.addListener('outboundSent', (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('outboundSent', dataJSON);
    } catch (exp) {}
  });

  gleapEmitter.addListener('feedbackFlowStarted', (feedbackAction) => {
    notifyCallback('feedbackFlowStarted', feedbackAction);
  });

  gleapEmitter.addListener('feedbackSendingFailed', () => {
    notifyCallback('feedbackSendingFailed');
  });

  gleapEmitter.addListener('notificationCountUpdated', (count) => {
    notifyCallback('notificationCountUpdated', count);
  });

  gleapEmitter.addListener('widgetOpened', () => {
    notifyCallback('widgetOpened');
  });

  gleapEmitter.addListener('widgetClosed', () => {
    notifyCallback('widgetClosed');
  });

  gleapEmitter.addListener('registerPushMessageGroup', (pushMessageGroup) => {
    notifyCallback('registerPushMessageGroup', pushMessageGroup);
  });

  gleapEmitter.addListener('unregisterPushMessageGroup', (pushMessageGroup) => {
    notifyCallback('unregisterPushMessageGroup', pushMessageGroup);
  });

  function isJsonString(str: string) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  gleapEmitter.addListener('customActionTriggered', (data: any) => {
    try {
      if (isJsonString(data)) {
        data = JSON.parse(data);
      }
      const { name, shareToken } = data;
      if (name) {
        notifyCallback('customActionTriggered', {
          name,
          shareToken,
        });
      }
    } catch (exp) {}
  });

  GleapSdk.removeAllAttachments();
  GleapSdk.touched = true;
}

export default GleapSdk as GleapSdkType;
