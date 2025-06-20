import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface UserProfile {
  id: string
  wallet_address: string
  email: string
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  creator_wallet_address: string
  recipient_address: string | null
  amount: number
  description: string
  status: 'pending' | 'paid' | 'expired'
  payment_hash: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
}

// Database functions
export const saveUserProfile = async (walletAddress: string, email: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      { 
        wallet_address: walletAddress.toLowerCase(), 
        email: email 
      },
      { 
        onConflict: 'wallet_address',
        ignoreDuplicates: false 
      }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving user profile:', error)
    throw error
  }

  return data
}

export const getUserProfile = async (walletAddress: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user profile doesn't exist
      return null
    }
    console.error('Error fetching user profile:', error)
    throw error
  }

  return data
}

// Invoice functions
export const createInvoice = async (
  creatorWalletAddress: string,
  amount: number,
  description: string,
  recipientAddress?: string
): Promise<Invoice> => {
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      creator_wallet_address: creatorWalletAddress.toLowerCase(),
      recipient_address: recipientAddress?.toLowerCase() || null,
      amount,
      description,
      status: 'pending'
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