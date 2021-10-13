import * as React from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GleapSDK from 'react-native-gleapsdk';

export default function App() {
  React.useEffect(() => {
    GleapSDK.initialize('UkzcTBCsX5nmsu2cV5hEcENkNuAT838O');
    GleapSDK.attachCustomData({ key: 'YOU' });
    GleapSDK.setCustomData('a', 'B');
    GleapSDK.setCustomData('b', 'c');
    GleapSDK.removeCustomDataForKey('b');
    GleapSDK.logEvent('ARE', { key: 'MOP' });
    GleapSDK.addAttachment('/data/media/0/Download/Untitled-1.png');
    fetch('http://example.com/movies.json');
  }, []);

  console.log(' JFKLJSLK');
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          GleapSDK.sendSilentBugReport('DOES THIS WORK?', 'HIGH');
          GleapSDK.startFeedbackFlow();
        }}
      >
        <Text>HOI</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
