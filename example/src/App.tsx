import * as React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Gleap from 'react-native-gleapsdk';
import SampleData from './SampleData';

export default function App() {
  React.useEffect(() => {
    Gleap.attachCustomData({ key: 'YOU' });
    Gleap.setCustomData('a', 'B');
    Gleap.setCustomData('b', 'c');
    Gleap.removeCustomDataForKey('b');
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.setLanguage('fr');
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.addAttachment(SampleData.img, 'test.jpg');
    Gleap.identify('12334', {
      name: 'Franzi',
      email: 'lukas@boehlerbrothers.com',
    });

    Gleap.registerCustomAction((data) => {
      console.log(data);
    });
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          Gleap.setActivationMethods(['SCREENSHOT']);
        }}
      >
        <Image
          source={require('./Logo.png')}
          style={{
            width: 200,
            height: 100,
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#060D25',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
