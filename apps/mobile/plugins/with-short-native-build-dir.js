// Windows only: the C++ builds (react-native-reanimated, the app's codegen) create object paths longer than 260
// characters, because CMake puts the absolute source path into them. The ninja of the SDK's default CMake (3.22) then
// fails. So every library and the app build with CMake 3.31.6 (sdkmanager "cmake;3.31.6"; needs Windows long paths
// enabled, LongPathsEnabled=1) in short folders under <repo>/.cxx/.
const { withProjectBuildGradle } = require('expo/config-plugins');

const marker = '// smarthome: short C++ build folders';
const snippet = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { p ->
    ['com.android.library', 'com.android.application'].each { id ->
      p.plugins.withId(id) {
        p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootDir, "../../../.cxx/" + Integer.toHexString(p.name.hashCode())).canonicalFile
        // its ninja (1.12) handles paths over 260 characters when Windows long paths are enabled
        p.android.externalNativeBuild.cmake.version = '3.31.6'
      }
    }
  }
}
`;

module.exports = function withShortNativeBuildDir(config) {
  return withProjectBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;
    // before the root project plugins: they evaluate the app project right away
    const anchor = 'apply plugin: "expo-root-project"';
    if (!contents.includes(marker)) {
      mod.modResults.contents = contents.includes(anchor) ? contents.replace(anchor, `${snippet.trim()}

${anchor}`) : contents + snippet;
    }
    return mod;
  });
};
