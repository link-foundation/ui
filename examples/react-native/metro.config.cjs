const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../..');
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(root, 'node_modules'),
];
config.resolver.extraNodeModules = {
  react: path.join(__dirname, 'node_modules/react'),
  'react-native': path.join(__dirname, 'node_modules/react-native'),
};
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  if (
    [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-native',
      'react-native-web',
    ].includes(name)
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'index.js') },
      name,
      platform
    );
  }
  return resolveRequest
    ? resolveRequest(context, name, platform)
    : context.resolveRequest(context, name, platform);
};
config.transformer.babelTransformerPath = require.resolve('./transformer.cjs');
config.resolver.sourceExts.push('lino');
module.exports = config;
