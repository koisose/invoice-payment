import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { parseUnits, formatEther, encodeFunctionData, erc20Abi } from "viem";
import { useConnect, useSendCalls, useAccount, useBalance, useChainId, useDisconnect, useReadContract } from "wagmi";
import { getInvoice, updateInvoiceWithPayment, saveUserProfile, getUserProfile, sendEmailNotification, Invoice, UserProfile } from "../lib/supabase";

interface PaymentResult {
  success: boolean;
  error?: string;
  transactionHash?: string;
  email?: string;
  saved?: boolean;
}

export default function InvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [emailsSent, setEmailsSent] = useState(false); // Track if emails have been sent

  const { sendCalls, data, error: sendCallsError, isPending, isSuccess, isError } = useSendCalls();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address,
    chainId: 0x14A34, // Base Sepolia (84532 in hex)
  });

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Load invoice data
  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  // Load user profile when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserProfile();
    } else {
      setUserProfile(null);
    }
  }, [isConnected, address]);

  // Handle payment completion - MAIN PAYMENT PROCESSING
  useEffect(() => {
    if (isSuccess && data && invoice && address && !emailsSent) {
      console.log('Payment transaction successful:', data);
      // @ts-ignore
      console.log('Transaction hash:', data.transactionHash);
      console.log('Payer address:', address);
      
      // Update invoice with recipient address and payment hash
      // @ts-ignore
      updateInvoiceWithPayment(invoice.id, address, data.transactionHash || '')
        .then(async (updatedInvoice) => {
          console.log('Invoice updated with payment details:', updatedInvoice);
          setInvoice(updatedInvoice);
          
          // Mark emails as being sent to prevent duplicates
          setEmailsSent(true);
          
          // Get creator's email for notification
          let creatorEmail = '';
          try {
            const creatorProfile = await getUserProfile(updatedInvoice.creator_wallet_address);
            if (creatorProfile?.email) {
              creatorEmail = creatorProfile.email;
              // Send payment confirmation email to creator
              await sendEmailNotification(
                'payment_confirmation',
                updatedInvoice,
                creatorProfile.email
              );
              console.log('Payment confirmation email sent to creator');
            }
          } catch (emailError) {
            console.error('Error sending creator notification:', emailError);
          }
          
          // Handle payer email from callback data
          let payerEmail = '';
          if (data?.capabilities?.dataCallback?.email) {
            payerEmail = data.capabilities.dataCallback.email;
            
            // Save payer email to profile
            try {
              await saveProfile(payerEmail);
              console.log('Payer email saved to profile');
              
              // Send payment receipt email to payer
              await sendEmailNotification(
                'payment_receipt',
                updatedInvoice,
                creatorEmail, // Pass creator email but it won't be used for receipt
                payerEmail
              );
              console.log('Payment receipt email sent to payer');
            } catch (profileError) {
              console.error('Error saving payer profile:', profileError);
            }
          }
          
          // Set final success result
          setPaymentResult({
            success: true,
            // @ts-ignore
            transactionHash: data.transactionHash || '',
            email: payerEmail,
            saved: !!payerEmail
          });
        })
        .catch((err) => {
          console.error('Error updating invoice with payment details:', err);
          console.error('Full error object:', JSON.stringify(err, null, 2));
          setPaymentResult({
            success: false,
            error: `Database update failed: ${err.message || 'Unknown error'}`
          });
        });
    }
  }, [isSuccess, data, invoice, address, emailsSent]);

  // Listen for sendCalls error
  useEffect(() => {
    if (isError && sendCallsError) {
      console.log('Payment transaction failed:', sendCallsError);
      setPaymentResult({ 
        success: false, 
        error: sendCallsError.message || "Payment failed" 
      });
    }
  }, [isError, sendCallsError]);

  async function loadInvoice() {
    if (!invoiceId) return;
    
    setLoading(true);
    try {
      const invoiceData = await getInvoice(invoiceId);
      if (!invoiceData) {
        setError("Invoice not found");
      } else {
        setInvoice(invoiceData);
      }
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

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

  async function saveProfile(email: string) {
    if (!address) return false;

    try {
      const profile = await saveUserProfile(address, email);
      setUserProfile(profile);
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }

  function getCallbackURL() {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-validation`;
  }

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

  function handleDisconnect() {
    disconnect();
    setPaymentResult(null);
    setUserProfile(null);
    setEmailsSent(false); // Reset email sent flag
  }

  function handleConnect() {
    connect({ connector: connectors[0] });
  }

  async function handlePayment() {
    if (!invoice || !address) return;

    try {
      console.log('Initiating payment for invoice:', invoice.id);
      console.log('Payment amount:', invoice.amount, 'USDC');
      console.log('Recipient:', invoice.creator_wallet_address);
      console.log('Payer:', address);
      
      setPaymentResult(null);
      setEmailsSent(false); // Reset email sent flag when starting new payment

      // Send USDC payment to the invoice creator
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
                invoice.creator_wallet_address as `0x${string}`,
                parseUnits(invoice.amount.toString(), 6),
              ],
            }),
          },
        ],
        capabilities: {
          dataCallback: {
            requests: [{ type: "email", optional: false }],
            callbackURL: getCallbackURL(),
          },
        },
      });
    } catch (err) {
      console.error('Error initiating payment:', err);
      setPaymentResult({ 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error occurred" 
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invoice Not Found</h1>
            <p className="text-gray-600 mb-6">{error || "The invoice you're looking for doesn't exist or has been removed."}</p>
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Invoice Payment</h1>
          <p className="text-lg text-gray-600">Complete your payment securely with crypto</p>
        </div>

        {/* Invoice Details Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              invoice.status === 'paid' 
                ? 'bg-green-100 text-green-800' 
                : invoice.status === 'expired'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {invoice.status.toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Invoice ID</p>
              <p className="text-gray-900 font-mono">{invoice.id.slice(0, 8)}...</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-gray-900">{invoice.amount} USDC</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Created</p>
              <p className="text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Expires</p>
              <p className="text-gray-900">
                {invoice.expires_at ? new Date(invoice.expires_at).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
            <p className="text-gray-900 bg-gray-50 rounded-xl p-4">{invoice.description}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-500 mb-2">Pay To</p>
            <p className="text-gray-900 font-mono text-sm bg-gray-50 rounded-xl p-4 break-all">
              {invoice.creator_wallet_address}
            </p>
          </div>

          {/* Show payment details if invoice is paid */}
          {invoice.status === 'paid' && (
            <>
              {invoice.recipient_address && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-500 mb-2">Paid By</p>
                  <p className="text-gray-900 font-mono text-sm bg-gray-50 rounded-xl p-4 break-all">
                    {invoice.recipient_address}
                  </p>
                </div>
              )}
              {invoice.payment_hash && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Transaction Hash</p>
                  <p className="text-gray-900 font-mono text-sm bg-gray-50 rounded-xl p-4 break-all">
                    {invoice.payment_hash}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Payment Section - Only show if invoice is pending and no successful payment */}
        {invoice.status === 'pending' && !paymentResult?.success && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
            {!isConnected ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h3>
                <p className="text-gray-600 mb-8">Connect your Coinbase Smart Wallet to pay this invoice</p>
                <button
                  onClick={handleConnect}
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect Wallet
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
                      >
                        {copySuccess ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="px-3 py-1 bg-red-200 text-red-800 rounded-lg text-sm font-medium hover:bg-red-300 transition-colors duration-200"
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
                        {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "Loading..."}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-green-600 font-medium">USDC Balance:</span>
                      <span className="ml-2 text-green-800">
                        {usdcBalance !== undefined ? `${(Number(usdcBalance) / 1e6).toFixed(2)} USDC` : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Pay</h3>
                  <p className="text-gray-600 mb-8">
                    You'll be prompted to provide your email for payment notifications
                  </p>
                  
                  <button
                    onClick={handlePayment}
                    disabled={isPending}
                    className={`inline-flex items-center px-8 py-4 font-semibold text-lg rounded-2xl transition-all duration-300 shadow-lg transform ${
                      isPending
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50'
                    }`}
                  >
                    {isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Pay {invoice.amount} USDC
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Already Paid Status */}
        {invoice.status === 'paid' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-200 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-green-800 mb-4">Payment Completed</h3>
            <p className="text-green-600">This invoice has already been paid.</p>
            {invoice.payment_hash && (
              <p className="text-sm text-green-600 mt-2 font-mono">
                Transaction: {invoice.payment_hash.slice(0, 10)}...
              </p>
            )}
          </div>
        )}

        {/* Expired Status */}
        {invoice.status === 'expired' && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-3xl p-8 border border-red-200 text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-800 mb-4">Invoice Expired</h3>
            <p className="text-red-600">This invoice has expired and can no longer be paid.</p>
          </div>
        )}

        {/* Payment Results */}
        {paymentResult && (
          <div className={`mt-8 p-6 rounded-2xl shadow-lg ${
            paymentResult.success 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200'
          }`}>
            {paymentResult.success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-4">Payment Successful!</h3>
                {paymentResult.transactionHash && (
                  <div className="bg-white/50 rounded-xl p-4 mb-4">
                    <p className="text-green-700">
                      <span className="font-semibold">Transaction Hash:</span> {paymentResult.transactionHash.slice(0, 10)}...
                    </p>
                  </div>
                )}
                {paymentResult.email && (
                  <div className="bg-white/50 rounded-xl p-4 mb-4">
                    <p className="text-green-700">
                      <span className="font-semibold">Email for notifications:</span> {paymentResult.email}
                    </p>
                    {paymentResult.saved && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Email saved to your profile for future transactions
                      </p>
                    )}
                  </div>
                )}
                <p className="text-green-600">
                  Both you and the invoice creator will receive email notifications.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-red-800 mb-4">Payment Failed</h3>
                <div className="bg-white/50 rounded-xl p-4">
                  <p className="text-red-700">{paymentResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}