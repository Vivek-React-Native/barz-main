// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// After moving to pnpm from npm, the below was required to get the app to build
// https://github.com/facebook/react-native/issues/27712#issuecomment-1596205623
const resolve = require('path').resolve;
const PROJECT_ROOT = __dirname;
const WORKSPACE_ROOT = resolve(PROJECT_ROOT, '../../');

module.exports = (() => {
  const defaultConfig = getDefaultConfig(__dirname);

  // The below is from https://docs.expo.dev/guides/monorepos/#create-our-first-app:
  // 1. Watch all files within the monorepo
  defaultConfig.watchFolders = [WORKSPACE_ROOT];

  // 2. Let Metro know where to resolve packages and in what order
  defaultConfig.resolver.nodeModulesPaths = [
    path.resolve(PROJECT_ROOT, 'node_modules'),
    path.resolve(WORKSPACE_ROOT, 'node_modules'),
  ];
  // 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
  // defaultConfig.resolver.disableHierarchicalLookup = true;

  // If detox (end to end testing tool) is enabled, then when compiling the app, swap in custom code
  // to mock pusher, the barz server, and twilio video.
  if ((process.env.DETOX_ENABLED || '').toLowerCase() === 'true') {
    console.log(
      '>>> DETOX_ENABLED set, adding detox.ts file extension and detoxMain package.json field...',
    );
    return {
      ...defaultConfig,
      resolver: {
        ...defaultConfig.resolver,
        // ref: https://facebook.github.io/metro/docs/configuration/#sourceexts
        sourceExts: ['detox.tsx', 'detox.ts', ...defaultConfig.resolver.sourceExts],
        // ref: https://facebook.github.io/metro/docs/configuration/#resolvermainfields
        resolverMainFields: ['mainDetox', ...defaultConfig.resolver.resolverMainFields],

        // NOTE: Originally due to
        // https://github.com/expo/expo/issues/19870#issuecomment-1310113475, this below line was
        // seemingly required to get the expo build to work in detox. However, after adding the
        // @gorhom/bottom-sheet package in later august 2023, it was determined through trial and
        // error that this line caused the build to break when DETOX_ENABLED=true was specified.
        // I've commented it out for now, but it would probably be good to really figure out what
        // was going on here and make an informed decision about its use.
        //
        // disableHierarchicalLookup: true,
      },
    };
  } else {
    return defaultConfig;
  }
})();
