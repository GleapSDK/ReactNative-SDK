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
  plan?: string;
  companyName?: string;
  companyId?: string;
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
  setNetworkLogsBlacklist(networkLogBlacklist: string[]): void;
  setNetworkLogPropsToIgnore(networkLogPropsToIgnore: string[]): void;
  setApiUrl(apiUrl: string): void;
  setFrameUrl(frameUrl: string): void;
  attachCustomData(customData: any): void;
  setCustomData(key: string, value: string): void;
  removeCustomDataForKey(key: string): void;
  clearCustomData(): void;
  setDisableInAppNotifications(disableInAppNotifications: boolean): void;
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
    customActionCallback: (data: { name: string }) => void
  ): void;
  getIdentity(): Promise<any>;
  isUserIdentified(): Promise<boolean>;
  setTicketAttribute(key: string, value: string): void;
  setAiTools(tools: {
    name: string;
    description: string;
    response: string;
    executionType: "auto" | "button";
    parameters: {
      name: string;
      description: string;
      type: "string" | "number" | "boolean";
      required: boolean;
      enums?: string[];
    }[];
  }[]): void;
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
  const networkLogger = new GleapNetworkIntercepter();

  // Push the network log to the native SDK.
  GleapSdk.startNetworkLogging = () => {
    // Set the callback.
    networkLogger.setUpdatedCallback(() => {
      if (!networkLogger) {
        return;
      }

      const requests = networkLogger.getRequests();

      if (
        requests &&
        GleapSdk &&
        typeof GleapSdk.attachNetworkLog !== 'undefined'
      ) {
        if (Platform.OS === 'android') {
          GleapSdk.attachNetworkLog(JSON.stringify(requests));
        } else {
          GleapSdk.attachNetworkLog(JSON.parse(JSON.stringify(requests)));
        }
      }
    });

    // Start the logger.
    networkLogger.start();
  };

  GleapSdk.stopNetworkLogging = () => {
    networkLogger.setStopped(true);
  };

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

  gleapEmitter.addListener('configLoaded', (config: any) => {
    try {
      const configJSON = config instanceof Object ? config : JSON.parse(config);
      if (configJSON.enableNetworkLogs) {
        GleapSdk.startNetworkLogging();
      }
      notifyCallback('configLoaded', configJSON);
    } catch (exp) { }
  });

  gleapEmitter.addListener('initialized', () => {
    try {
      notifyCallback('initialized');
    } catch (exp) { }
  });

  gleapEmitter.addListener('toolExecution', (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('toolExecution', dataJSON);
    } catch (exp) { }
  });

  gleapEmitter.addListener('feedbackSent', (data) => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('feedbackSent', dataJSON);
    } catch (exp) { }
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
      const { name } = data;
      if (name) {
        notifyCallback('customActionTriggered', {
          name,
        });
      }
    } catch (exp) { }
  });

  GleapSdk.removeAllAttachments();
  GleapSdk.touched = true;
}

export default GleapSdk as GleapSdkType;
