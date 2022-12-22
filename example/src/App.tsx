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
    Gleap.setLanguage('AR_IQ');
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.logEvent('ARE', { key: 'MOP' });
    Gleap.addAttachment(SampleData.img, 'test.jpg');

    Gleap.log("This is a test log.");
    
    Gleap.logWithLogLevel("This is a test log WARNING.", "WARNING");
    Gleap.logWithLogLevel("This is a test log ERROR.", "ERROR");
    Gleap.logWithLogLevel("This is a test log Info.", "INFO");

    Gleap.identifyWithUserHash(
      'USER_ID',
      {
        name: 'Franzi',
        email: 'lukas@boehlerbrothers.com',
        value: 123,
        phone: '+49 123456789',
      },
      'USER_TOKEN'
    );

    Gleap.registerCustomAction((data) => {
      console.log(data);
    });
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          Gleap.open();
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
