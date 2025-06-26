import { useEffect, useState } from 'react';
import { useWallet, useAccount } from '@getpara/react-sdk';
import { supabase, Invoice } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Copy, Check, FileDown } from 'lucide-react';
import { getChainName } from '../lib/utils';

export default function InvoiceList() {
  const { data: wallet } = useWallet();
  const { data: account } = useAccount();
  const address = wallet?.address;
  const creatorEmail = account?.email;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  async function copyEmail(email: string, invoiceId: string) {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmailId(invoiceId);
      setTimeout(() => setCopiedEmailId(null), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  }

  async function handleMarkAsPaid(invoice: Invoice) {
    if (!creatorEmail) {
      alert("Could not find creator email. Please ensure you are logged in with an account that has an email.");
      return;
    }

    setUpdatingInvoiceId(invoice.id);

    try {
      // 1. Update invoice status in DB
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id)
        .select();

      if (updateError) throw updateError;

      // 2. Send email notification via Supabase Edge Function
      const { error: functionError } = await supabase.functions.invoke('send-email-notification', {
        body: {
          type: 'payment_receipt',
          payer_email: invoice.recipient_email,
          creator_email: creatorEmail,
          invoice: {
            id: invoice.id,
            amount: invoice.amount,
            description: invoice.description,
            creator_wallet_address: invoice.creator_wallet_address,
            recipient_address: invoice.recipient_address || 'N/A',
            payment_hash: invoice.payment_hash || 'N/A (Marked as paid manually)',
            created_at: invoice.created_at,
          },
        },
      });

      if (functionError) {
        console.error('Failed to send email notification:', functionError);
        alert(`Invoice status updated, but failed to send email: ${functionError.message}`);
      }

      // 3. Update local state to reflect the change
      setInvoices(currentInvoices =>
        currentInvoices.map(inv =>
          inv.id === invoice.id ? { ...inv, status: 'paid' } : inv
        )
      );

    } catch (error: any) {
      console.error('Failed to mark invoice as paid:', error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  useEffect(() => {
    async function fetchInvoices() {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('creator_wallet_address', address.toLowerCase())
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          setInvoices(data as Invoice[]);
        }
      } catch (error) {
        console.error('Error fetching invoices:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [address]);

  if (loading) {
    return <div className="mt-8 text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Loading your invoices...</p></div>;
  }

  if (invoices.length === 0) {
    return (
      <div className="mt-8 text-center p-8 bg-gray-50/50 rounded-2xl border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-700">No Invoices Found</h3>
        <p className="text-gray-500 mt-2">You haven't created any invoices with this wallet yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Your Invoices</h2>
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 transition-all hover:shadow-xl hover:border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-lg text-gray-800">Invoice #{invoice.id.slice(0, 8)}...</p>
                <p className="text-sm text-gray-500 mt-1">{invoice.description || "No description"}</p>
              </div>
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {invoice.status}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Amount</p>
                <p className="font-semibold text-gray-900 text-base">{invoice.amount} {invoice.token_symbol}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <div className="flex items-center space-x-2">
                  <p className="font-semibold text-gray-900 truncate max-w-[150px]" title={invoice.recipient_email || ''}>
                    {invoice.recipient_email || 'N/A'}
                  </p>
                  {invoice.recipient_email && (
                    <button
                      onClick={() => copyEmail(invoice.recipient_email!, invoice.id)}
                      className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Copy email"
                    >
                      {copiedEmailId === invoice.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-500">Network</p>
                <p className="font-semibold text-gray-900">{getChainName(invoice.chain_id)}</p>
              </div>
               <div>
                <p className="text-gray-500">Created</p>
                <p className="font-semibold text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200/80 flex justify-end items-center space-x-3">
              <Link
                to={`/invoice/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors duration-200 flex items-center"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Save as PDF
              </Link>
              {invoice.status === 'pending' && (
                <button
                  onClick={() => handleMarkAsPaid(invoice)}
                  disabled={updatingInvoiceId === invoice.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {updatingInvoiceId === invoice.id ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Mark as Paid'
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
