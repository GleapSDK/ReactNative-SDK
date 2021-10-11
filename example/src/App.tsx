import * as React from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GleapSDK from 'react-native-gleapsdk';

export default function App() {
  React.useEffect(() => {
    GleapSDK.initialize('7qnF4SaW8daomwcBLdXAd8ahlIYJtxos');
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
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
