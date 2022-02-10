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
};

type GleapSdkType = {
  initialize(token: string): void;
  open(): void;
  startFeedbackFlow(feedbackFlow: string): void;
  sendSilentBugReport(
    description: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
  ): void;
  identify(userId: string, userProperties: GleapUserProperty): void;
  clearIdentity(): void;
  setApiUrl(apiUrl: string): void;
  setWidgetUrl(widgetUrl: string): void;
  attachCustomData(customData: any): void;
  setCustomData(key: string, value: string): void;
  removeCustomDataForKey(key: string): void;
  clearCustomData(): void;
  registerCustomAction(
    customActionCallback: (data: { name: string }) => void
  ): void;
  setLanguage(language: string): void;
  logEvent(name: string, data: any): void;
  addAttachment(base64file: string, fileName: string): void;
  removeAllAttachments(): void;
  startNetworkLogging(): void;
  stopNetworkLogging(): void;
  enableDebugConsoleLog(): void;
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

  GleapSdk.startNetworkLogging = () => {
    networkLogger.start();
  };

  GleapSdk.stopNetworkLogging = () => {
    networkLogger.setStopped(true);
  };

  var callbacks: any[] = [];

  GleapSdk.registerCustomAction = (customActionCallback: any) => {
    callbacks.push(customActionCallback);
  };

  const gleapEmitter = new NativeEventEmitter(GleapSdk);

  gleapEmitter.addListener('configLoaded', (config: any) => {
    try {
      const configJSON = config instanceof Object ? config : JSON.parse(config);
      if (configJSON.enableNetworkLogs) {
        GleapSdk.startNetworkLogging();
      }
    } catch (exp) {}
  });

  gleapEmitter.addListener('feedbackWillBeSent', () => {
    // Push the network log to the native SDK.
    const requests = networkLogger.getRequests();
    if (Platform.OS === 'android') {
      GleapSdk.attachNetworkLog(JSON.stringify(requests));
    } else {
      GleapSdk.attachNetworkLog(JSON.parse(JSON.stringify(requests)));
    }
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
      if (name && callbacks.length > 0) {
        for (var i = 0; i < callbacks.length; i++) {
          if (callbacks[i]) {
            callbacks[i]({
              name,
            });
          }
        }
      }
    } catch (exp) {}
  });

  GleapSdk.touched = true;
}

export default GleapSdk as GleapSdkType;
