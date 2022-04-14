module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "entry",
        corejs: 3,
      },
    ],
    "@babel/typescript",
  ],
  env: {
    development: {},
    production: {
      presets: ["minify"],
    },
  },
};
