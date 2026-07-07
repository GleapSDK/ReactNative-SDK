/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import Gleap from 'react-native-gleapsdk';

// Executes the "send-money" Frontend tool defined on the AI agent in the Gleap dashboard.
Gleap.registerAgentTool('send-money', async params => {
  console.log('send-money called with params', params);
  return 'The transfer got initiated but not completed yet. The user must confirm the transfer in the banking app.';
});

Gleap.setTicketAttribute('note', 'This is a test value.');

Gleap.unsetTicketAttribute('note');

Gleap.clearTicketAttributes();

Gleap.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');

Gleap.registerCustomAction(customAction => {
  console.log('customAction', JSON.stringify(customAction, null, 2));
});

Gleap.registerListener('toolExecution', data => {
  console.log('data', data);
});

Gleap.registerListener('outboundSent', data => {
  console.log('outboundSent', data);
});

Gleap.registerListener('feedbackSent', data => {
  console.log('feedbackSent', data);
});

AppRegistry.registerComponent(appName, () => App);
