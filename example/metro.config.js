/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

// The SDK is linked from the repo root (react-native-gleapsdk -> ../..), and
// the root has its own dev copies of its peer dependencies. Resolving
// `react-native` from ../src would pick those, bundling a second React Native
// whose event emitter never receives native events (configLoaded, ...).
// Block the root copies and resolve the peers from the example app.
const root = path.resolve(__dirname, '..');
const peerDependencies = ['react', 'react-native'];

const escapeRegExp = value => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    blockList: exclusionList(
      peerDependencies.map(
        name =>
          new RegExp(
            `^${escapeRegExp(path.join(root, 'node_modules', name))}\\/.*$`,
          ),
      ),
    ),
    extraNodeModules: peerDependencies.reduce((modules, name) => {
      modules[name] = path.join(__dirname, 'node_modules', name);
      return modules;
    }, {}),
    nodeModulesPaths: [path.join(__dirname, 'node_modules')],
  },
  watchFolders: [root],
};
