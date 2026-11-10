-- public.coupons_with_codes ran with its owner's rights, so it skipped the RLS on
-- coupons and promo_codes and showed every promo code to anon and authenticated.
-- Nothing in the app reads it. No CASCADE: if something on the database depends
-- on this view, fail here rather than silently drop that object too.
DROP VIEW IF EXISTS public.coupons_with_codes;
