const transformer = require('@expo/metro-config/babel-transformer');
module.exports.transform = (options) =>
  transformer.transform({
    ...options,
    src: options.filename.endsWith('.lino')
      ? `export default ${JSON.stringify(options.src)};`
      : options.src,
  });
