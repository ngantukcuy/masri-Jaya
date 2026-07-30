import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.masrijaya.pos',
  appName: 'Masri Jaya POS',
  webDir: 'dist',
  server: {
    // Keep everything (including the deep links your app already uses)
    // loading from inside the bundled web assets rather than a remote URL.
    androidScheme: 'https',
  },
};

export default config;
