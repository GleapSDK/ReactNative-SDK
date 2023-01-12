import * as React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Gleap from 'react-native-gleapsdk';

export default function App() {
  React.useEffect(() => {
    Gleap.identify('asdfasdf999', {
      name: 'Franzi',
      email: 'lukas@boehlerbrothers.com',
      value: 123,
      phone: '+49 123456789',
      customData: {
        fancykey: 'Lukas ist cool, sent by android',
        aNumber: 1938,
        newKey: 'new value',
      },
    });

    Gleap.trackPage('Home 2');
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={async () => {
          // console.log('getIdentity', await Gleap.getIdentity());
          // console.log('isUserIdentified', await Gleap.isUserIdentified());
          // console.log('isOpened', await Gleap.isOpened());
          // Gleap.openHelpCenter(false);
          Gleap.trackPage('NEW PAGE NAME');
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
