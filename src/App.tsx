import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { ParaProvider, Environment } from '@getpara/react-sdk'
import { getConfig } from './wagmi'
import Home from './components/Home'
import LandingPage from './components/LandingPage'
import InvoicePage from './components/InvoicePage'

function App() {
  const [config] = useState(() => getConfig())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        paraClientConfig={{
          apiKey: import.meta.env.VITE_PARA_API_KEY || "",
          env: Environment.BETA,
        }}
      >
        <WagmiProvider config={config}>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/app" element={<Home />} />
              <Route path="/invoice/:invoiceId" element={<InvoicePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </WagmiProvider>
      </ParaProvider>
    </QueryClientProvider>
  )
}

export default App