import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvoice, Invoice } from '../lib/supabase';

export default function InvoicePDF() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) {
      const loadInvoice = async () => {
        try {
          setLoading(true);
          const fetchedInvoice = await getInvoice(invoiceId);
          if (fetchedInvoice) {
            setInvoice(fetchedInvoice);
          } else {
            setError('Invoice not found.');
          }
        } catch (err) {
          setError('Failed to load invoice.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadInvoice();
    }
  }, [invoiceId]);

  function getChainName(chainId: number) {
    switch (chainId) {
      case 84532: return "Base Sepolia";
      case 8453: return "Base";
      case 1: return "Ethereum";
      case 11155111: return "Sepolia";
      default: return `Chain ${chainId}`;
    }
  }

  if (loading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  if (!invoice) {
    return <div className="text-center p-10">Invoice not found.</div>;
  }

  return (
    <div className="bg-white min-h-screen">
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8 no-print">
            <h1 className="text-2xl font-bold">Invoice Preview</h1>
            <button
                onClick={() => window.print()}
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
                Print / Save as PDF
            </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-8">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Invoice</h2>
                    <p className="text-gray-500">ID: {invoice.id}</p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-semibold">{invoice.amount} {invoice.token_symbol}</p>
                    <p className="text-gray-500">Status: <span className="font-medium text-gray-800">{invoice.status.toUpperCase()}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Created On</p>
                    <p className="text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Network</p>
                    <p className="text-gray-900">{getChainName(invoice.chain_id)}</p>
                </div>
            </div>
            
            <div className="mb-8">
                <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                <p className="text-gray-900">{invoice.description || 'N/A'}</p>
            </div>

            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Pay To Address</p>
                <p className="text-gray-900 font-mono text-sm break-all">{invoice.creator_wallet_address}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
