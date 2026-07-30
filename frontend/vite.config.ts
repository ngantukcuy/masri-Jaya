import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import pkg from './package.json';

export default defineConfig(() => {
  return {
    // Makes the version in package.json (which should be bumped on every
    // release, and is kept in sync with android/app/build.gradle's
    // versionName) available at runtime as __APP_VERSION__, so the UI never
    // shows a stale/hardcoded version string again.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react(), tailwindcss()],
    build: {
      // Ship source maps for production bundles (PageSpeed/Lighthouse
      // flags large first-party JS with no source map). These are only
      // fetched by browser devtools, not by regular page loads, so this
      // doesn't add to what real users download.
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
