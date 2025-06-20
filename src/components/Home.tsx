import { useEffect, useState } from "react";
import { parseUnits, formatEther, encodeFunctionData, erc20Abi } from "viem";
import { useConnect, useSendCalls, useAccount, useBalance, useChainId, useDisconnect } from "wagmi";

interface DataRequest {
  email: boolean;
  address: boolean;
}

interface ProfileResult {
  success: boolean;
  email?: string;
  address?: string;
  error?: string;
}

export default function Home() {
  const [dataToRequest, setDataToRequest] = useState<DataRequest>({
    email: true,
    address: true
  });
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const { sendCalls, data, error, isPending } = useSendCalls();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address,
    chainId: 0x14A34, // Base Sepolia (84532 in hex)
  });

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
  }

  // Handle response data when sendCalls completes
  useEffect(() => {
    if (data?.capabilities?.dataCallback) {
      const callbackData = data.capabilities.dataCallback;
      const newResult: ProfileResult = { success: true };

      // Extract email if provided
      if (callbackData.email) newResult.email = callbackData.email;

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

      // Build requests array based on checkboxes
      const requests = [];
      if (dataToRequest.email) requests.push({ type: "email", optional: false });
      if (dataToRequest.address) requests.push({ type: "physicalAddress", optional: false });

      if (requests.length === 0) {
        setResult({ success: false, error: "Select at least one data type" });
        return;
      }

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
                "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
                parseUnits("0.01", 6),
              ],
            }),
          },
        ],
          // chainId: 84532, // Base Sepolia, // Base Sepolia (84532 in hex)
        capabilities: {
          dataCallback: {
            requests: requests,
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
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h1>Profiles Demo</h1>

      {/* Data Request Form */}
      <div style={{ marginTop: "20px" }}>
        <h2>Checkout</h2>

        {/* Connect Wallet Button */}
        {!isConnected ? (
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={handleConnect}
              style={{
                padding: "12px 24px",
                backgroundColor: "#0052FF",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Connect with Coinbase Smart Wallet
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#e8f5e8", borderRadius: "8px", border: "1px solid #c3e6c3" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ color: "#2d5a2d", fontSize: "14px", marginRight: "8px" }}>
                  <strong>Connected:</strong> {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button
                  onClick={copyAddress}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: copySuccess ? "#28a745" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "background-color 0.2s"
                  }}
                  title="Copy full address"
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "500",
                  transition: "background-color 0.2s"
                }}
                title="Disconnect wallet"
              >
                Disconnect
              </button>
            </div>
            <p style={{ margin: "0 0 8px 0", color: "#2d5a2d", fontSize: "14px" }}>
              <strong>Chain:</strong> {getChainName(chainId)} ({chainId})
            </p>
            <p style={{ margin: 0, color: "#2d5a2d", fontSize: "14px" }}>
              <strong>Balance:</strong> {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "Loading..."}
            </p>
          </div>
        )}

        <div>
          <label>
            <input
              type="checkbox"
              checked={dataToRequest.email}
              onChange={() => setDataToRequest(prev => ({ ...prev, email: !prev.email }))}
            />
            Email Address
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={dataToRequest.address}
              onChange={() => setDataToRequest(prev => ({ ...prev, address: !prev.address }))}
            />
            Physical Address
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending || !isConnected}
          style={{
            opacity: (!isConnected || isPending) ? 0.6 : 1,
            cursor: (!isConnected || isPending) ? "not-allowed" : "pointer"
          }}
        >
          {isPending ? "Processing..." : "Checkout"}
        </button>
      </div>

      {/* Results Display */}
      {result && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: result.success ? "#d4edda" : "#f8d7da",
          borderRadius: "5px"
        }}>
          {result.success ? (
            <>
              <h3>Data Received</h3>
              {result.email && <p><strong>Email:</strong> {result.email}</p>}
              {result.address && <p><strong>Address:</strong> {result.address}</p>}
            </>
          ) : (
            <>
              <h3>Error</h3>
              <p>{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}