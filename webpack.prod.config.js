const config = require('./webpack.config.js')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  ...config,
  mode: 'production',
  devtool: false,
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
  },
}
