import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Invoice {
  token_symbol: string;
  id: string
  creator_wallet_address: string
  recipient_address: string | null
  recipient_email: string | null
  amount: number
  description: string
  status: 'pending' | 'paid' | 'expired'
  payment_hash: string | null
  created_at: string
  updated_at: string
  chain_id: number
}

// Invoice functions
export const createInvoice = async (invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'status' | 'payment_hash' | 'recipient_address'>): Promise<Invoice> => {
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      ...invoice,
      creator_wallet_address: invoice.creator_wallet_address.toLowerCase(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invoice:', error)
    throw error
  }

  return data
}

export const getInvoice = async (invoiceId: string): Promise<Invoice | null> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - invoice doesn't exist
      return null
    }
    console.error('Error fetching invoice:', error)
    throw error
  }

  return data
}

export const getUserInvoices = async (walletAddress: string): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('creator_wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user invoices:', error)
    throw error
  }

  return data || []
}

export const updateInvoiceStatus = async (
  invoiceId: string,
  status: 'pending' | 'paid' | 'expired',
  paymentHash?: string
): Promise<Invoice> => {
  const updateData: any = { status }
  if (paymentHash) {
    updateData.payment_hash = paymentHash
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice status:', error)
    throw error
  }

  return data
}

// New function to update invoice with complete payment details
export const updateInvoiceWithPayment = async (
  invoiceId: string,
  recipientAddress: string,
  paymentHash: string
): Promise<Invoice> => {
  console.log('Updating invoice with payment details:', {
    invoiceId,
    recipientAddress,
    paymentHash,
    status: 'paid'
  });

  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      recipient_address: recipientAddress.toLowerCase(),
      payment_hash: paymentHash
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice with payment details:', error)
    throw error
  }

  return data
}

// Email notification functions
export const sendEmailNotification = async (
  type: 'payment_confirmation' | 'payment_receipt',
  invoice: Invoice,
  creatorEmail: string,
  payerEmail?: string
): Promise<boolean> => {
  try {
    const emailRequest = {
      type,
      invoice,
      creator_email: creatorEmail,
      payer_email: payerEmail
    };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(emailRequest),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email notification failed:', result);
      return false;
    }

    console.log('Email notification sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}