import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yoga.detection',
  appName: 'Yoga Pose Detection',
  webDir: 'build',
  server: {
    hostname: 'localhost',
    androidScheme: 'http'
  }
};

export default config;
