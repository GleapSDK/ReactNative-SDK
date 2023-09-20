/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import Gleap from 'react-native-gleapsdk';

Gleap.initialize('X5C0grjFCjUMbZKi131MjZLaGRwg2iKH');

AppRegistry.registerComponent(appName, () => App);
