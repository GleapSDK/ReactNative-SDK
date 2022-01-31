import { AppRegistry } from 'react-native';
import App from './src/App';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';

Gleap.enableDebugConsoleLog();
Gleap.initialize('Y0ASDsS3Se1PJG1aYNIblrFMMX4zGgig');

AppRegistry.registerComponent(appName, () => App);
