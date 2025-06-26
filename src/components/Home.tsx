import { useEffect, useState } from "react";
import { parseUnits, formatEther, encodeFunctionData, erc20Abi } from "viem";
import { useSendCalls, useBalance, useChainId, useReadContract } from "wagmi";
import { useAccount, useModal, useWallet } from "@getpara/react-sdk";
import { saveUserProfile, getUserProfile, UserProfile, createInvoice, Invoice } from "../lib/supabase";

interface DataRequest {
  email: boolean;
  address: boolean;
}

interface ProfileResult {
  success: boolean;
  email?: string;
  address?: string;
  error?: string;
  saved?: boolean;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    amount: '',
    description: '',
    email: ''
  });
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const { sendCalls, data, error, isPending } = useSendCalls();
  
  // Use Para's React SDK hooks
  const { data: account } = useAccount();
  const { data: wallet } = useWallet();
  const { openModal, closeModal } = useModal();
  
  // Extract connection status and address from Para wallet
  const isConnected = !!wallet?.address;
  const address = wallet?.address;
  
  const chainId = useChainId();
  
  // ETH balance using wagmi hook
  const { data: ethBalance, isLoading: isEthLoading } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: 84532, // Base Sepolia chain ID
    query: {
      enabled: !!address,
    },
  });

  // USDC balance using wagmi hook
  const { data: usdcBalance, isLoading: isUsdcLoading } = useBalance({
    address: address as `0x${string}` | undefined,
    token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC contract on Base Sepolia
    chainId: 84532, // Base Sepolia chain ID
    query: {
      enabled: !!address,
    },
  });

  // Function to mask email address
  function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email; // Invalid email format
    
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

  // Load user profile when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserProfile();
    } else {
      setUserProfile(null);
    }
  }, [isConnected, address]);

  // Function to load user profile from database
  async function loadUserProfile() {
    if (!address) return;
    
    setIsLoadingProfile(true);
    try {
      const profile = await getUserProfile(address);
      setUserProfile(profile);
      // Pre-fill email if user has a profile
      if (profile?.email) {
        setInvoiceData(prev => ({ ...prev, email: profile.email }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  }

  // Function to save user profile to database
  async function saveProfile(email: string) {
    if (!address) return;

    try {
      const profile = await saveUserProfile(address, email);
      setUserProfile(profile);
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }

  // Function to get chain name
  function getChainName(chainId: number) {
    switch (chainId) {
      case 84532: // Base Sepolia
        return "Base Sepolia";
      case 8453: // Base
        return "Base";
      case 1: // Ethereum
        return "Ethereum";
      case 11155111: // Sepolia
        return "Sepolia";
      default:
        return `Chain ${chainId}`;
    }
  }

  // Function to copy address to clipboard
  async function copyAddress() {
    if (!address) return;
    
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }

  // Function to copy share link to clipboard
  async function copyShareLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      // You could add a separate state for this if needed
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  }

  // Function to disconnect wallet using Para's logout
  async function handleDisconnect() {
    try {
      // Use Para's logout functionality
      if (account?.logout) {
        await account.logout();
      }
      setResult(null); // Clear any previous results
      setUserProfile(null); // Clear user profile
      setShowInvoiceForm(false); // Hide invoice form
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Handle invoice form submission
  async function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;

    setIsCreatingInvoice(true);

    try {
      // Save user profile if email is provided and user doesn't have a profile yet
      if (invoiceData.email.trim() && !userProfile) {
        await saveProfile(invoiceData.email.trim());
      }

      // Create invoice in database
      const invoice = await createInvoice(
        address,
        parseFloat(invoiceData.amount),
        invoiceData.description
      );

      // Generate share link
      const shareLink = `${window.location.origin}/invoice/${invoice.id}`;
      
      setResult({
        success: true,
        email: invoiceData.email,
        saved: true,
        invoice,
        shareLink
      });
      
      // Reset form
      setInvoiceData({
        amount: '',
        description: '',
        email: userProfile?.email || ''
      });
      setShowInvoiceForm(false);
    } catch (err) {
      setResult({
        success: false,
        error: "Failed to create invoice"
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  // Handle wallet connection using Para's modal
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
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Create Crypto Invoice</h1>
          <p className="text-lg text-gray-600">Generate your professional crypto invoice with email notifications</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
          {/* Connect Wallet Section */}
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
              <p className="text-gray-600 mb-8">Connect with Para to get started with invoice creation using social login or email</p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect with Para
              </button>
            </div>
          ) : (
            <>
              {/* Wallet Info */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">Wallet Connected</p>
                      <p className="text-sm text-green-600">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={copyAddress}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                        copySuccess 
                          ? 'bg-green-500 text-white' 
                          : 'bg-green-200 text-green-800 hover:bg-green-300'
                      }`}
                      title="Copy full address"
                    >
                      {copySuccess ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1 bg-red-200 text-red-800 rounded-lg text-sm font-medium hover:bg-red-300 transition-colors duration-200"
                      title="Disconnect wallet"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">Network:</span>
                    <span className="ml-2 text-green-800">{getChainName(chainId)}</span>
                  </div>
                  <div>
                    <span className="text-green-600 font-medium">ETH Balance:</span>
                    <span className="ml-2 text-green-800">
                      {isEthLoading ? "Loading..." : ethBalance ? `${parseFloat(ethBalance.formatted).toFixed(4)} ${ethBalance.symbol}` : "0.0000 ETH"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-green-600 font-medium">USDC Balance:</span>
                    <span className="ml-2 text-green-800">
                      {isUsdcLoading ? "Loading..." : usdcBalance ? `${parseFloat(usdcBalance.formatted).toFixed(2)} ${usdcBalance.symbol}` : "0.00 USDC"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Existing Profile Info */}
              {isLoadingProfile ? (
                <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-200">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-blue-700">Loading profile...</span>
                  </div>
                </div>
              ) : userProfile ? (
                <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">Profile Found</p>
                      <p className="text-sm text-blue-600">Your email is already registered</p>
                    </div>
                  </div>
                  <div className="bg-white/50 rounded-xl p-4">
                    <p className="text-blue-700">
                      <span className="font-semibold">Registered Email:</span> {maskEmail(userProfile.email)}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      Registered on {new Date(userProfile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Invoice Creation Section */}
              {!showInvoiceForm ? (
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Invoice</h2>
                  <p className="text-gray-600 mb-8">
                    Create a professional invoice and receive email notifications when payments are completed
                  </p>
                  
                  <button
                    onClick={() => setShowInvoiceForm(true)}
                    className="inline-flex items-center px-8 py-4 font-semibold text-lg rounded-2xl transition-all duration-300 shadow-lg transform bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Create Invoice
                  </button>
                </div>
              ) : (
                /* Invoice Form */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
                    <button
                      onClick={() => setShowInvoiceForm(false)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (USDC)
                      </label>
                      <input
                        type="number"
                        id="amount"
                        step="0.01"
                        value={invoiceData.amount}
                        onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="100.00"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">All invoices are denominated in USDC</p>
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        id="description"
                        rows={3}
                        value={invoiceData.description}
                        onChange={(e) => setInvoiceData({...invoiceData, description: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Web development services for Q1 2025"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Your Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={invoiceData.email}
                        onChange={(e) => setInvoiceData({...invoiceData, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="your@email.com"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        You'll receive email notifications when payments are completed
                        {!userProfile && " (This will also save your email to your profile)"}
                      </p>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Email Notifications</p>
                          <p className="text-xs text-blue-600 mt-1">
                            You will receive email notifications when the payment is completed, and your client will receive a payment receipt.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingInvoice}
                      className={`w-full py-4 font-semibold text-lg rounded-2xl transition-all duration-300 shadow-lg transform ${
                        isCreatingInvoice
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50'
                      }`}
                    >
                      {isCreatingInvoice ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-200 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Invoice...
                        </>
                      ) : (
                        'Create Invoice'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Results Display */}
        {result && (
          <div className={`mt-8 p-6 rounded-2xl shadow-lg ${
            result.success 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200'
          }`}>
            {result.success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-4">Invoice Created Successfully!</h3>
                
                {/* Invoice Details */}
                {result.invoice && (
                  <div className="bg-white/50 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div>
                        <p className="text-green-700">
                          <span className="font-semibold">Invoice ID:</span> {result.invoice.id.slice(0, 8)}...
                        </p>
                        <p className="text-green-700">
                          <span className="font-semibold">Amount:</span> {result.invoice.amount} USDC
                        </p>
                      </div>
                      <div>
                        <p className="text-green-700">
                          <span className="font-semibold">Status:</span> {result.invoice.status.toUpperCase()}
                        </p>
                        <p className="text-green-700">
                          <span className="font-semibold">Created:</span> {new Date(result.invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-green-700">
                        <span className="font-semibold">Description:</span> {result.invoice.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Share Link */}
                {result.shareLink && (
                  <div className="bg-white/50 rounded-xl p-6 mb-4">
                    <p className="text-green-700 font-semibold mb-3">Share this link with your client:</p>
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-3">
                      <input
                        type="text"
                        value={result.shareLink}
                        readOnly
                        className="flex-1 bg-transparent text-gray-700 text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => copyShareLink(result.shareLink!)}
                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors duration-200"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                )}

                {result.email && (
                  <div className="bg-white/50 rounded-xl p-4 mb-4">
                    <p className="text-green-700">
                      <span className="font-semibold">Email for notifications:</span> {maskEmail(result.email)}
                    </p>
                    {result.saved && !userProfile && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Email saved to your profile for future invoices
                      </p>
                    )}
                  </div>
                )}
                {result.address && (
                  <div className="bg-white/50 rounded-xl p-4">
                    <p className="text-green-700">
                      <span className="font-semibold">Address:</span> {result.address}
                    </p>
                  </div>
                )}
                <p className="text-green-600 mt-4">
                  You'll receive email notifications when payments are completed.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-red-800 mb-4">Error Creating Invoice</h3>
                <div className="bg-white/50 rounded-xl p-4">
                  <p className="text-red-700">{result.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}