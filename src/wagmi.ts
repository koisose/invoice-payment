import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { paraConnector } from "@getpara/wagmi-v2-integration";
import Para, { Environment, OAuthMethod } from "@getpara/web-sdk";

// Initialize Para client
const para = new Para(Environment.BETA, import.meta.env.VITE_PARA_API_KEY || "");

// Create Para connector with proper configuration to prevent multiple root creation
const connector = paraConnector({
  para,
  chains: [baseSepolia],
  appName: "Crypto Invoice Platform",
  options: {
    // Prevent multiple modal instances
    preventMultipleInstances: true,
  },
  nameOverride: "Para",
  idOverride: "para",
  oAuthMethods: [
    OAuthMethod.GOOGLE,
    OAuthMethod.TWITTER,
    OAuthMethod.DISCORD,
  ],
  disableEmailLogin: false,
  disablePhoneLogin: false,
  onRampTestMode: true,
  customTheme: {
    accentColor: "#3b82f6",
    backgroundColor: "#FFFFFF",
  },
});

export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [connector],
    transports: {
      [baseSepolia.id]: http(),
    },
    // Add SSR configuration to prevent hydration issues
    ssr: false,
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}