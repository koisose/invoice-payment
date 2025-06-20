import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

const cbWalletConnector = coinbaseWallet({
  appName: "Profiles Demo",
  preference: {
    options: "smartWalletOnly",
  },
});

export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [cbWalletConnector],
    transports: {
      [baseSepolia.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}