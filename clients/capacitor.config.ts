import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.peracom.decp",
  appName: "peracom-decp",
  webDir: "dist",
  server: {
    url: "http://192.168.2.184:8080",
    cleartext: true,
  },
};

export default config;
