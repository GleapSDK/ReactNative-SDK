import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import GleapNetworkIntercepter from './networklogger';
const LINKING_ERROR = `The package 'react-native-gleapsdk' doesn't seem to be linked. Make sure: \n\n` + Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo managed workflow\n';
const GleapSdk = NativeModules.Gleapsdk ? NativeModules.Gleapsdk : new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }

});

if (GleapSdk && !GleapSdk.touched) {
  const networkLogger = new GleapNetworkIntercepter(); // Push the network log to the native SDK.

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
    }); // Start the logger.

    networkLogger.start();
  };

  GleapSdk.stopNetworkLogging = () => {
    networkLogger.setStopped(true);
  };

  var callbacks = {};

  GleapSdk.registerListener = (eventType, callback) => {
    if (!callbacks[eventType]) {
      callbacks[eventType] = [];
    }

    callbacks[eventType].push(callback);
  };

  GleapSdk.registerCustomAction = customActionCallback => {
    GleapSdk.registerListener('customActionTriggered', customActionCallback);
  };

  const notifyCallback = function (eventType, data) {
    if (callbacks && callbacks[eventType] && callbacks[eventType].length > 0) {
      for (var i = 0; i < callbacks[eventType].length; i++) {
        if (callbacks[eventType][i]) {
          callbacks[eventType][i](data);
        }
      }
    }
  };

  const gleapEmitter = new NativeEventEmitter(NativeModules.Gleapsdk);
  gleapEmitter.addListener('configLoaded', config => {
    try {
      const configJSON = config instanceof Object ? config : JSON.parse(config);

      if (configJSON.enableNetworkLogs) {
        GleapSdk.startNetworkLogging();
      }

      notifyCallback('configLoaded', configJSON);
    } catch (exp) {}
  });
  gleapEmitter.addListener('feedbackSent', data => {
    try {
      const dataJSON = data instanceof Object ? data : JSON.parse(data);
      notifyCallback('feedbackSent', dataJSON);
    } catch (exp) {}
  });
  gleapEmitter.addListener('feedbackFlowStarted', feedbackAction => {
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

  function isJsonString(str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }

    return true;
  }

  gleapEmitter.addListener('customActionTriggered', data => {
    try {
      if (isJsonString(data)) {
        data = JSON.parse(data);
      }

      const {
        name
      } = data;

      if (name) {
        notifyCallback('customActionTriggered', {
          name
        });
      }
    } catch (exp) {}
  });
  GleapSdk.removeAllAttachments();
  GleapSdk.touched = true;
}

export default GleapSdk;
//# sourceMappingURL=index.js.map