# Coupon System Usage Example

## Database Migration

The migration `20250919_create_coupons_table.sql` creates:

1. **Enum**: `coupon_status_enum` with values: 'active', 'inactive', 'expired'
2. **Table**: `coupons` with the following structure:
   - Links to `events` via `event_id`
   - Stores Stripe coupon details
   - Tracks usage and expiration
   - Row Level Security policies for access control

## API Usage

### Create a Coupon

**POST** `/api/stripe/coupon`

```json
{
  "couponName": "Early Bird Discount",
  "eventId": "uuid-of-event",
  "percent_off": 25,
  "duration": "once",
  "max_redemptions": 100,
  "redeem_by": "2025-12-31T23:59:59Z",
  "codes": ["EARLYBIRD25", "EARLY2025", "BIRD25"]
}
```

Or for a fixed amount discount:

```json
{
  "couponName": "Student Discount",
  "eventId": "uuid-of-event",
  "amount_off": 1000,
  "currency": "usd",
  "duration": "once",
  "max_redemptions": 50,
  "codes": ["STUDENT10", "STUDENT2025", "EDU10"]
}
```

### Get Event Coupons

**GET** `/api/stripe/coupon?eventId=uuid-of-event`

Returns all active coupons for the specified event.

## Features

### Security
- Only admin users or event organizers can create coupons
- Users can only view active coupons for events they have access to
- RLS policies enforce proper access control

### Validation
- Ensures either `percent_off` or `amount_off` is provided (not both)
- Validates `currency` is provided when using `amount_off`
- Percent discounts must be between 1-100
- Amount discounts must be positive
- Validates `codes` is an array of strings if provided

### Integration
- Creates coupons in Stripe and stores reference in database
- Applies coupons to all products associated with event pricing tiers
- Maintains consistency between Stripe and database (rollback on errors)

### Automatic Management
- Function to update expired coupons based on `redeem_by` date
- Tracks redemption count
- Supports various duration types (once, repeating, forever)

## Database Structure

```sql
-- Key columns in coupons table:
- id: UUID primary key
- event_id: Foreign key to events table
- stripe_coupon_id: Unique Stripe coupon identifier
- name: Human-readable coupon name
- codes: Array of promo codes (text[])
- percent_off/amount_off: Discount amount (mutually exclusive)
- duration: How long discount applies
- max_redemptions: Usage limit
- times_redeemed: Current usage count
- status: active/inactive/expired
- redeem_by: Expiration date
```

## Future Enhancements

1. **Promo Code Generation**: Auto-generate memorable promo codes
2. **Usage Analytics**: Track which coupons are most effective
3. **Automatic Expiration**: Cron job to mark expired coupons
4. **Email Integration**: Send coupon codes to specific user groups
5. **Bulk Operations**: Create multiple coupons at once
