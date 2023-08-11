/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import Gleap from 'react-native-gleapsdk';

Gleap.initialize('hciNpT8z64tsHATINYZjWBvbirVWCKWt');

AppRegistry.registerComponent(appName, () => App);
