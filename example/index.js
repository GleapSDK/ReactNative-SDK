/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import Gleap from 'react-native-gleapsdk';

Gleap.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');

AppRegistry.registerComponent(appName, () => App);
