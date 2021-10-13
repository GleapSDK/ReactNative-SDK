import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GleapSDK from 'react-native-gleapsdk';

export default function App() {
  React.useEffect(() => {
    GleapSDK.initialize('ogWhNhuiZcGWrva5nlDS8l7a78OfaLlV');
    GleapSDK.attachCustomData({ key: 'YOU' });
    GleapSDK.setCustomData('a', 'B');
    GleapSDK.setCustomData('b', 'c');
    GleapSDK.removeCustomDataForKey('b');
    GleapSDK.logEvent('ARE', { key: 'MOP' });
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          GleapSDK.sendSilentBugReport('Sneaky silent bug report.', 'HIGH');
          GleapSDK.startFeedbackFlow();
        }}
      >
        <Text>Gleap Example</Text>
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
