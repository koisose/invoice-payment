TRUNCATE TABLE public.invoices RESTART IDENTITY CASCADE;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_creator_wallet_address_fkey;
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_creator_wallet_address_fkey;
DROP TABLE IF EXISTS public.user_profiles;
