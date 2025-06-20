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