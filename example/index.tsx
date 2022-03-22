import { AppRegistry } from 'react-native';
import App from './src/App';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';

Gleap.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');

Gleap.registerListener('customActionTriggered', (data) => {
  console.log('customActionTriggered');
  console.log(data);
});

Gleap.registerListener('configLoaded', (data) => {
  console.log('configLoaded');
  // console.log(data);
});

Gleap.registerListener('feedbackWillBeSent', (data) => {
  console.log('feedbackWillBeSent');
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
