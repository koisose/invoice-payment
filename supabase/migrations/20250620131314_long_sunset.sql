/*
  # Create invoices table

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `creator_wallet_address` (text, references user_profiles.wallet_address)
      - `recipient_address` (text, wallet address of who should pay)
      - `amount` (numeric, amount to pay in USDC)
      - `description` (text, invoice description)
      - `status` (text, payment status: 'pending', 'paid', 'expired')
      - `payment_hash` (text, transaction hash when paid)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `expires_at` (timestamp, optional expiration date)

  2. Security
    - Enable RLS on `invoices` table
    - Add policy for creators to manage their invoices
    - Add policy for public read access to invoices (for payment)

  3. Indexes
    - Index on creator_wallet_address for fast lookups
    - Index on status for filtering
    - Unique index on id for direct access
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet_address text NOT NULL,
  recipient_address text,
  amount numeric(20, 6) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  payment_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  FOREIGN KEY (creator_wallet_address) REFERENCES user_profiles(wallet_address) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Creators can manage their invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (creator_wallet_address = (
    SELECT wallet_address FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Public can read invoices for payment"
  ON invoices
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_creator_wallet ON invoices(creator_wallet_address);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();