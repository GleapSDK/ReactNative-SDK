/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import Gleap from 'react-native-gleapsdk';

Gleap.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');

Gleap.registerListener('customActionTriggered', (data) => {
    console.log("data", data);
    if (data.name === 'CUSTOM_HELP') {
        setTimeout(() => {
            Gleap?.openHelpCenterCollection("1", true);
        }, 1500);
    }
});

AppRegistry.registerComponent(appName, () => App);
