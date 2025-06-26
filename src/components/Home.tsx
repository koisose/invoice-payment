import { useEffect, useState, ChangeEvent } from "react";
import { parseUnits, formatEther, encodeFunctionData, erc20Abi } from "viem";
import { useSendCalls, useBalance, useChainId, useReadContract } from "wagmi";
import { useAccount, useModal, useWallet, useLogout } from "@getpara/react-sdk";
import { createInvoice, Invoice } from "../lib/supabase";
import { ChevronDown } from "lucide-react";
import { getChainName } from "../lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InvoiceList from "./InvoiceList";

interface DataRequest {
  email: boolean;
  address: boolean;
}

interface ProfileResult {
  success: boolean;
  email?: string;
  address?: string;
  error?: string;
  invoice?: Invoice;
  shareLink?: string;
}

interface InvoiceData {
  amount: string;
  description: string;
  email: string;
}

export default function Home() {
  const [dataToRequest, setDataToRequest] = useState<DataRequest>({
    email: true,
    address: true
  });
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    amount: '',
    description: '',
    email: ''
  });
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number>(84532); // Default to Base Sepolia
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');

  const supportedChains = [
    { id: 84532, name: 'Base Sepolia' },
    { id: 8453, name: 'Base' },
    { id: 1, name: 'Ethereum' },
    { id: 11155111, name: 'Sepolia' },
  ];

  const { sendCalls, data, error, isPending } = useSendCalls();
  
  const { data: account } = useAccount();
  const { data: wallet } = useWallet();
  const { openModal, closeModal } = useModal();
  
  const isConnected = !!wallet?.address;
  const address = wallet?.address;
  
  const chainId = useChainId();
  
  const { data: ethBalance, isLoading: isEthLoading } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: 84532,
    query: {
      enabled: !!address,
    },
  });

  function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(Math.max(1, localPart.length - 2))
      : '*'.repeat(localPart.length);
    const domainParts = domain.split('.');
    const maskedDomain = domainParts.map(part => 
      part.length > 2 
        ? part.substring(0, 1) + '*'.repeat(Math.max(1, part.length - 2)) + part.slice(-1)
        : '*'.repeat(part.length)
    ).join('.');
    return `${maskedLocal}@${maskedDomain}`;
  }

  function getChainName(chainId: number) {
    switch (chainId) {
      case 84532: return "Base Sepolia";
      case 8453: return "Base";
      case 1: return "Ethereum";
      case 11155111: return "Sepolia";
      default: return `Chain ${chainId}`;
    }
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }

  async function copyShareLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      alert('Share link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  }

  const { logout } = useLogout();

  async function handleDisconnect() {
    logout();
  }

  async function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;

    setIsCreatingInvoice(true);
    setResult(null);

    try {
      const invoice = await createInvoice({
        amount: parseFloat(invoiceData.amount),
        description: invoiceData.description,
        creator_wallet_address: address,
        chain_id: selectedChainId,
        recipient_email: invoiceData.email,
        token_symbol: selectedCurrency,
      });

      const shareLink = `${window.location.origin}/invoice/${invoice.id}`;
      setResult({ success: true, invoice, shareLink });
      setShowInvoiceForm(false);
      setInvoiceData({ amount: '', description: '', email: '' });
    } catch (error) {
      console.error(error);
      setResult({
        success: false,
        error: "Failed to create invoice"
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  function handleConnect() {
    try {
      openModal();
    } catch (error) {
      console.error('Error opening Para modal:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Create Crypto Invoice</h1>
          <p className="text-lg text-gray-600">Generate your professional crypto invoice with email notifications</p>
        </div>

        {!isConnected ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
              <p className="text-gray-600 mb-8">Connect with Para to get started with invoice creation using social login or email</p>
              <button
                onClick={() => handleConnect()}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect with Para
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">Wallet Connected</p>
                      <button onClick={() => openModal()} className="text-sm text-green-600 underline cursor-pointer">Connected: {`${address?.slice(0, 6)}...${address?.slice(-4)}`}</button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => copyAddress()} className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${copySuccess ? 'bg-green-500 text-white' : 'bg-green-200 text-green-800 hover:bg-green-300'}`} title="Copy full address">{copySuccess ? "Copied!" : "Copy"}</button>
                    <button onClick={() => handleDisconnect()} className="px-3 py-1 bg-red-200 text-red-800 rounded-lg text-sm font-medium hover:bg-red-300 transition-colors duration-200" title="Disconnect wallet">Disconnect</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">Network:</span>
                    <span className="ml-2 text-green-800">{getChainName(chainId)}</span>
                  </div>
                  <div>
                    <span className="text-green-600 font-medium">ETH Balance:</span>
                    <span className="ml-2 text-green-800">{isEthLoading ? "Loading..." : ethBalance ? `${parseFloat(ethBalance.formatted).toFixed(4)} ${ethBalance.symbol}` : "0.0000 ETH"}</span>
                  </div>
                </div>
              </div>

              {!showInvoiceForm ? (
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Invoice</h2>
                  <p className="text-gray-600 mb-8">Create a professional invoice and receive email notifications when payments are completed</p>
                  <button onClick={() => setShowInvoiceForm(true)} className="inline-flex items-center px-8 py-4 font-semibold text-lg rounded-2xl transition-all duration-300 shadow-lg transform bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Create Invoice
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
                    <button onClick={() => setShowInvoiceForm(false)} className="text-gray-500 hover:text-gray-700 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <div className="flex">
                        <input type="number" id="amount" step="0.01" value={invoiceData.amount} onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})} className="w-full px-4 py-3 border border-r-0 border-gray-300 rounded-l-xl focus:ring-2 focus:ring-blue-500 focus:z-10 focus:border-transparent transition-all duration-200" placeholder="100.00" required />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" className="rounded-l-none rounded-r-xl h-auto py-3 font-normal">{selectedCurrency}<ChevronDown className="h-4 w-4 opacity-60 ml-2" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent><DropdownMenuRadioGroup value={selectedCurrency} onValueChange={setSelectedCurrency}><DropdownMenuRadioItem value="USDC">USDC</DropdownMenuRadioItem><DropdownMenuRadioItem value="ETH">ETH</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea id="description" rows={3} value={invoiceData.description} onChange={(e) => setInvoiceData({...invoiceData, description: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="Web development services for Q1 2025" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Network</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between px-4 py-3 rounded-xl text-base h-auto font-normal">{supportedChains.find(c => c.id === selectedChainId)?.name}<ChevronDown className="h-4 w-4 opacity-60" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Select a Chain</DropdownMenuLabel><DropdownMenuSeparator />
                          <DropdownMenuRadioGroup value={String(selectedChainId)} onValueChange={(value) => setSelectedChainId(Number(value))}>
                            {supportedChains.map((chain) => (<DropdownMenuRadioItem key={chain.id} value={String(chain.id)}>{chain.name}</DropdownMenuRadioItem>))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Client's Email for Notifications</label>
                      <input type="email" id="email" value={invoiceData.email} onChange={(e) => setInvoiceData({...invoiceData, email: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="client@example.com" required />
                    </div>
                    <button type="submit" disabled={isCreatingInvoice} className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed">{isCreatingInvoice ? 'Creating...' : 'Create Invoice'}</button>
                  </form>
                </div>
              )}
            </div>
            
            {result && (
              <div className={`mt-8 p-6 rounded-2xl shadow-lg ${result.success ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200'}`}>
                {result.success ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                    <h3 className="text-2xl font-bold text-green-800 mb-4">Invoice Created Successfully!</h3>
                    {result.invoice && (
                      <div className="bg-white/50 rounded-xl p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                          <div>
                            <p className="text-green-700"><span className="font-semibold">Invoice ID:</span> {result.invoice.id.slice(0, 8)}...</p>
                            <p className="text-green-700"><span className="font-semibold">Amount:</span> {result.invoice.amount} {result.invoice.token_symbol}</p>
                          </div>
                          <div>
                            <p className="text-green-700"><span className="font-semibold">Status:</span> {result.invoice.status.toUpperCase()}</p>
                            <p className="text-green-700"><span className="font-semibold">Created:</span> {new Date(result.invoice.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="mt-4"><p className="text-green-700"><span className="font-semibold">Description:</span> {result.invoice.description}</p></div>
                      </div>
                    )}
                    {result.shareLink && (
                      <div className="bg-white/50 rounded-xl p-6 mb-4">
                        <p className="text-green-700 font-semibold mb-3">Share this link with your client:</p>
                        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-3">
                          <input type="text" value={result.shareLink} readOnly className="flex-1 bg-transparent text-gray-700 text-sm focus:outline-none" />
                          <button onClick={() => copyShareLink(result.shareLink!)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors duration-200">Copy Link</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></div>
                    <h3 className="text-2xl font-bold text-red-800 mb-4">Error Creating Invoice</h3>
                    <div className="bg-white/50 rounded-xl p-4"><p className="text-red-700">{result.error}</p></div>
                  </div>
                )}
              </div>
            )}
            <InvoiceList />
          </>
        )}
      </div>
    </div>
  );
}