import { AppRegistry } from 'react-native';
import App from './src/App';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';

Gleap.enableDebugConsoleLog();
// Gleap.setActivationMethods(['SCREENSHOT']);
Gleap.initialize('KProDXhMS0V3UUku2iNnrZ4XsBnAYzxt');
Gleap.showFeedbackButton(true);

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

AppRegistry.registerComponent(appName, () => App);
