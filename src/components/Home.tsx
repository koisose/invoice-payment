import { useEffect, useState } from "react";
import { parseUnits, formatEther, encodeFunctionData, erc20Abi } from "viem";
import { useConnect, useSendCalls, useAccount, useBalance, useChainId, useDisconnect } from "wagmi";
import { saveUserProfile, getUserProfile, UserProfile } from "../lib/supabase";

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

  const { sendCalls, data, error, isPending } = useSendCalls();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address,
    chainId: 0x14A34, // Base Sepolia (84532 in hex)
  });

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

  // Function to get callback URL - using Supabase Edge Function
  function getCallbackURL() {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-validation`;
  }

  // Function to get chain name
  function getChainName(chainId: number) {
    switch (chainId) {
      case 0x14A34: // 84532 in hex
        return "Base Sepolia";
      case 0x2105: // 8453 in hex
        return "Base";
      case 0x1: // 1 in hex
        return "Ethereum";
      case 0xAA36A7: // 11155111 in hex
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

  // Function to disconnect wallet
  function handleDisconnect() {
    disconnect();
    setResult(null); // Clear any previous results
    setUserProfile(null); // Clear user profile
  }

  // Handle response data when sendCalls completes
  useEffect(() => {
    if (data?.capabilities?.dataCallback) {
      const callbackData = data.capabilities.dataCallback;
      const newResult: ProfileResult = { success: true };

      // Extract email if provided
      if (callbackData.email) {
        newResult.email = callbackData.email;
        
        // Save to database
        saveProfile(callbackData.email).then((saved) => {
          newResult.saved = saved;
          setResult({ ...newResult });
        });
      }

      // Extract address if provided
      if (callbackData.physicalAddress) {
        const addr = callbackData.physicalAddress.physicalAddress;
        newResult.address = [
          addr.address1,
          addr.address2,
          addr.city,
          addr.state,
          addr.postalCode,
          addr.countryCode
        ].filter(Boolean).join(", ");
      }

      setResult(newResult);
    } else if (data && !data.capabilities?.dataCallback) {
      setResult({ success: false, error: "Invalid response - no data callback" });
    }
  }, [data]);

  // Handle errors
  useEffect(() => {
    if (error) {
      setResult({ 
        success: false, 
        error: error.message || "Transaction failed" 
      });
    }
  }, [error]);

  // Handle form submission
  async function handleSubmit() {
    try {
      setResult(null);

      // Send calls using wagmi hook - Send 0 ETH to zero address
      sendCalls({
        connector: connectors[0],
        account: null,
        calls: [
          {
            to: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC contract address on Base Sepolia
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [
                "0x08621A0e2D7692154083fa742735EbcfCA301bf0",
                parseUnits("0", 6),
              ],
            }),
          },
        ],
          // chainId: 84532, // Base Sepolia, // Base Sepolia (84532 in hex)
        capabilities: {
          dataCallback: {
            requests: [{ type: "email", optional: false }],
            callbackURL: getCallbackURL(),
          },
        },
      });
    } catch (err) {
      setResult({ 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error occurred" 
      });
    }
  }

  // Handle wallet connection
  function handleConnect() {
    connect({ connector: connectors[0] });
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
              <p className="text-gray-600 mb-8">Connect your Coinbase Smart Wallet to get started with invoice creation</p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect with Coinbase Smart Wallet
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
                      <p className="text-sm text-green-600">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
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
                    <span className="text-green-600 font-medium">Balance:</span>
                    <span className="ml-2 text-green-800">
                      {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "Loading..."}
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
                      <span className="font-semibold">Registered Email:</span> {userProfile.email}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      Registered on {new Date(userProfile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Invoice Creation */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {userProfile ? 'Create New Invoice' : 'Create Invoice & Register Email'}
                </h2>
                <p className="text-gray-600 mb-8">
                  {userProfile 
                    ? 'Create another invoice using your registered email'
                    : 'Your email will be automatically saved and included for payment notifications'
                  }
                </p>
                
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className={`inline-flex items-center px-8 py-4 font-semibold text-lg rounded-2xl transition-all duration-300 shadow-lg transform ${
                    isPending
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50'
                  }`}
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Create Invoice
                    </>
                  )}
                </button>
              </div>
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
                {result.email && (
                  <div className="bg-white/50 rounded-xl p-4 mb-4">
                    <p className="text-green-700">
                      <span className="font-semibold">Email for notifications:</span> {result.email}
                    </p>
                    {result.saved && (
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