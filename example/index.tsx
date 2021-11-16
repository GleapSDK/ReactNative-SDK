import { AppRegistry } from 'react-native';
import App from './src/App';
import Gleap from 'react-native-gleapsdk';
import { name as appName } from './app.json';

Gleap.enableDebugConsoleLog();
Gleap.initialize('wytzEhhSa1EFfTEqK3HXBWuGRt2PREAE');

AppRegistry.registerComponent(appName, () => App);
