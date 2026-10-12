-- Migration: Drop check_paid_event_has_pricing_tiers function and trigger
-- Date: 2025-09-20
-- Description: Removes the check_paid_event_has_pricing_tiers function and its associated trigger

-- Drop the trigger first (triggers depend on functions)
DROP TRIGGER IF EXISTS ensure_paid_event_has_pricing_tiers ON public.events;

-- Drop the function
DROP FUNCTION IF EXISTS public.check_paid_event_has_pricing_tiers();