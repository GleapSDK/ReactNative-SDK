import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import GleapNetworkIntercepter from './networklogger';

const LINKING_ERROR =
  `The package 'react-native-gleapsdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

export type GleapUserSession = {
  id: string;
  hash: string;
  email?: string;
  name?: string;
};

type GleapSdkType = {
  initialize(token: string): void;
  //Todo initialize with GleapUserSession
  initializeWithUserSession(
    token: string,
    gleapUserSession: GleapUserSession
  ): void;
  startFeedbackFlow(): void;
  sendSilentBugReport(
    description: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
  ): void;
  identifyUser(gleapUserSession: GleapUserSession): void;
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
  logEvent(name: string, data: any): void;
  //TODO: FILETYPE?
  addAttachment(file: any): void;
  removeAllAttachments(): void;
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
const networkLogger = new GleapNetworkIntercepter();

if (GleapSdk) {
  var callbacks: any[] = [];
  GleapSdk.registerCustomAction = (customActionCallback: any) => {
    callbacks.push(customActionCallback);
  };
  const gleapEmitter = new NativeEventEmitter(GleapSdk);
  gleapEmitter.addListener('bugWillBeSent', () => {
    // Push the network log to the native SDK.
    const requests = networkLogger.getRequests();
    if (Platform.OS === 'android') {
      GleapSdk.attachNetworkLog(JSON.stringify(requests));
    } else {
      GleapSdk.attachNetworkLog(requests);
    }
  });
  gleapEmitter.addListener('customActionTriggered', (data) => {
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
  });
}

function isJsonString(str: string) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export default GleapSdk as GleapSdkType;
