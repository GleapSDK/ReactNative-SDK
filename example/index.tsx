import { AppRegistry } from 'react-native';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';
import App from './src/App';

Gleap.enableDebugConsoleLog();
// Gleap.setActivationMethods(['SCREENSHOT']);
Gleap.initialize('DUPaIr7s689BBblcFI4pc5aBgYJTm7Sc');
Gleap.showFeedbackButton(true);

setTimeout(() => {
  Gleap.showSurvey('1g9pym', 'survey');
}, 3000);

Gleap.registerListener('customActionTriggered', (data) => {
  console.log('customActionTriggered');
  console.log(data);
});

Gleap.registerListener('configLoaded', (data) => {
  console.log('configLoaded');
  console.log(data);
});

Gleap.registerListener('feedbackSent', (data) => {
  console.log('feedbackSent');
  console.log(data);
});

Gleap.registerListener('feedbackSendingFailed', (data) => {
  console.log('feedbackSendingFailed');
  console.log(data);
});

Gleap.registerListener('registerPushMessageGroup', (data) => {
  console.log('registerPushMessageGroup');
  console.log(data);
});

Gleap.registerListener('unregisterPushMessageGroup', (data) => {
  console.log('unregisterPushMessageGroup');
  console.log(data);
});

AppRegistry.registerComponent(appName, () => App);
