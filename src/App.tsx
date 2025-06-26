import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ParaProvider,
  Environment,

} from '@getpara/react-sdk';
import { baseSepolia } from 'wagmi/chains';
import { http, createConfig } from 'wagmi';
import { paraConnector } from '@getpara/wagmi-v2-integration';
import Para from '@getpara/web-sdk';
import Home from './components/Home';
import LandingPage from './components/LandingPage';
import InvoicePage from './components/InvoicePage';

// Create queryClient outside the component to ensure a single instance.
const queryClient = new QueryClient();

function App() {
  const [paraConfig] = useState(() => {
    const para = new Para(Environment.BETA, import.meta.env.VITE_PARA_API_KEY || '');

    // Pass queryClient to the connector as required by the linter.
    const connector = paraConnector({
      para,
      queryClient,
      chains: [baseSepolia],
      appName: 'Crypto Invoice Platform',
      options: {
        shimDisconnect: true,
      },
      oAuthMethods: [
        'GOOGLE',
        'TWITTER',
        'APPLE',
        'DISCORD',
        'FACEBOOK',
        'FARCASTER',
        'TELEGRAM',
      ],
      disableEmailLogin: false,
      disablePhoneLogin: false,
      onRampTestMode: true,
      theme: {
        accentColor: '#3b82f6',
        backgroundColor: '#FFFFFF',
      },
    }) as any;

    const wagmiConfig = createConfig({
      chains: [baseSepolia],
      connectors: [connector],
      transports: {
        [baseSepolia.id]: http(),
      },
      ssr: false,
    });

    // Create the final config object for ParaProvider, satisfying the 'appName' requirement.
    return {
      ...wagmiConfig,
      appName: 'Crypto Invoice Platform',
    };
  });

  return (
    // Provide the single queryClient instance to the provider.
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        paraClientConfig={{
          apiKey: import.meta.env.VITE_PARA_API_KEY || '',
          env: Environment.BETA,
        }}
        // Pass the combined config object.
        config={paraConfig}
      >
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<Home />} />
            <Route path="/invoice/:invoiceId" element={<InvoicePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ParaProvider>
    </QueryClientProvider>
  );
}

export default App;