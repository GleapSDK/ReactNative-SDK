import { AppRegistry } from 'react-native';
import App from './src/App';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';

Gleap.setApiUrl('http://localhost:9000');
Gleap.enableDebugConsoleLog();
Gleap.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');

AppRegistry.registerComponent(appName, () => App);
