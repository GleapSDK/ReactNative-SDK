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
};

type GleapActivationMethod = 'SHAKE' | 'SCREENSHOT';

type GleapSdkType = {
  initialize(token: string): void;
  startFeedbackFlow(feedbackFlow: string, showBackButton: boolean): void;
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
  open(): void;
  close(): void;
  isOpened(): boolean;
  identify(userId: string, userProperties: GleapUserProperty): void;
  identifyWithUserHash(
    userId: string,
    userProperties: GleapUserProperty,
    userHash: string
  ): void;
  clearIdentity(): void;
  preFillForm(formData: { [key: string]: string }): void;
  setApiUrl(apiUrl: string): void;
  setFrameUrl(frameUrl: string): void;
  attachCustomData(customData: any): void;
  setCustomData(key: string, value: string): void;
  removeCustomDataForKey(key: string): void;
  clearCustomData(): void;
  registerListener(eventType: string, callback: (data?: any) => void): void;
  setLanguage(language: string): void;
  enableDebugConsoleLog(): void;
  disableConsoleLog(): void;
  log(message: string): void;
  logWithLogLevel(message: string, logLevel: 'INFO' | 'WARNING' | 'ERROR'): void;
  trackEvent(name: string, data: any): void;
  addAttachment(base64file: string, fileName: string): void;
  removeAllAttachments(): void;
  startNetworkLogging(): void;
  stopNetworkLogging(): void;
  setActivationMethods(activationMethods: GleapActivationMethod[]): void;
  registerCustomAction(
    customActionCallback: (data: { name: string }) => void
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
  const networkLogger = new GleapNetworkIntercepter();

  // Push the network log to the native SDK.
  GleapSdk.startNetworkLogging = () => {
    // Set the callback.
    networkLogger.setUpdatedCallback(() => {
      if (!networkLogger) {
        return;
      }

      const requests = networkLogger.getRequests();
   
      if (requests && GleapSdk && typeof GleapSdk.attachNetworkLog !== 'undefined') {
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

  gleapEmitter.addListener('widgetOpened', () => {
    notifyCallback('widgetOpened');
  });

  gleapEmitter.addListener('widgetClosed', () => {
    notifyCallback('widgetClosed');
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
