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
          fetch('https://api.npms.io/v2/search?q=react')
            .then((response) => response.json())
            .then((data) => {
              console.log(data);
            });

          var xmlHttp = new XMLHttpRequest();
          xmlHttp.onreadystatechange = function () {};
          xmlHttp.open('GET', 'https://api.npms.io/v2/search?q=react', true); // true for asynchronous
          xmlHttp.send(null);
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
