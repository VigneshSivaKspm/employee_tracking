const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches ExpoModulesCorePlugin.gradle for AGP 8.x compatibility.
 *
 * Root cause: `singleVariant("release")` inside `android { publishing {} }`
 * does not register the software component synchronously. When `afterEvaluate`
 * runs with AGP 8.6+, `components.release` throws MissingPropertyException.
 *
 * Fix: wrap the `from components.release` call in try-catch so the build
 * continues without Maven local publishing (which we don't need for APK/AAB).
 */
const withGradleFix = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pluginGradlePath = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'expo-modules-core',
        'android',
        'ExpoModulesCorePlugin.gradle'
      );

      if (!fs.existsSync(pluginGradlePath)) {
        console.warn('[withGradleFix] ExpoModulesCorePlugin.gradle not found, skipping patch.');
        return config;
      }

      let content = fs.readFileSync(pluginGradlePath, 'utf8');

      if (content.includes('AGP8_PATCHED')) {
        return config;
      }

      if (content.includes('from components.release')) {
        content = content.replace(
          'from components.release',
          [
            '// AGP8_PATCHED: components.release unavailable in afterEvaluate with AGP 8.6+',
            '          def relComp = project.components.findByName("release")',
            '          if (relComp != null) { from relComp }',
          ].join('\n')
        );
        fs.writeFileSync(pluginGradlePath, content, 'utf8');
        console.log('[withGradleFix] Patched ExpoModulesCorePlugin.gradle for AGP 8.x compatibility.');
      }

      return config;
    },
  ]);
};

module.exports = withGradleFix;
