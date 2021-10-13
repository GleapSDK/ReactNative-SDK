import * as React from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GleapSDK, { GleapUserSession } from 'react-native-gleapsdk';

export default function App() {
  React.useEffect(() => {
    const session: GleapUserSession = {
      id: '12',
      hash: '3ec01e9f99aa53258626cd85bde0d3af859004f904c2ab30725de2720196526e',
      email: 'e',
      name: 'B',
    };
    GleapSDK.initializeWithUserSession(
      'UkzcTBCsX5nmsu2cV5hEcENkNuAT838O',
      session
    );
    GleapSDK.attachCustomData({ key: 'YOU' });
    GleapSDK.setCustomData('a', 'B');
    GleapSDK.setCustomData('b', 'c');
    GleapSDK.removeCustomDataForKey('b');
    GleapSDK.logEvent('ARE', { key: 'MOP' });
    GleapSDK.addAttachment('/data/media/0/Download/Untitled-1.png');
  }, []);

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
