# Pricing Tiers Feature

## Overview

The pricing tiers feature allows event organizers to set multiple pricing options for their events, such as Early Bird, Regular, and VIP tiers. This provides more flexibility in pricing strategies and can help maximize revenue.

## Features

### For Event Organizers

1. **Pricing Tab**: New dedicated tab in the organizer dashboard for managing pricing
2. **Multiple Tiers**: Add unlimited pricing tiers with different prices and features
3. **Tier Configuration**: Each tier supports:
   - Name (e.g., "Early Bird", "Regular", "VIP")
   - Price (in USD)
   - Description
   - Available until date (for limited-time offers)
   - Maximum quantity (for limited availability)
   - Stripe Price ID (for payment processing)

### For Event Participants

1. **Tier Selection**: When joining a paid event with multiple tiers, users see a tier selection interface
2. **Tier Details**: Each tier shows price, description, availability, and quantity remaining
3. **Smart Pricing**: Button shows "From $X" where X is the cheapest available tier

## Database Schema

### New Fields

- `events.pricing_tiers`: JSONB array containing pricing tier configurations
- `user_event_payments.pricing_tier_id`: ID of selected pricing tier
- `user_event_payments.pricing_tier_name`: Name of selected pricing tier

### Migration

Run the following migrations in order:
1. `20250120_add_pricing_tiers.sql` - Adds pricing_tiers column and constraints
2. `20250120_migrate_legacy_pricing.sql` - Migrates existing single-price events

## Usage

### Setting Up Pricing Tiers

1. Navigate to your event in the organizer dashboard
2. Click the "Pricing" tab
3. Toggle "This is a paid event" to enable pricing
4. Add pricing tiers with the "Add Pricing Tier" button
5. Configure each tier with name, price, description, and optional settings
6. Save the configuration

### Stripe Integration

For each pricing tier that should accept payments:
1. Create a corresponding Price in your Stripe Dashboard
2. Copy the Stripe Price ID (starts with `price_`)
3. Paste it into the "Stripe Price ID" field for that tier

### Backward Compatibility

The system maintains backward compatibility with existing single-price events. Events using the old `price` and `stripe_price_id` fields will continue to work, and can be migrated to the new system using the data migration.

## Technical Implementation

### Key Components

- `PricingTab.tsx`: Main UI for managing pricing tiers
- `PricingTierSelector.tsx`: UI for users to select pricing tiers
- `pricing.ts`: Utility functions for pricing logic
- Updated Stripe integration to handle tier-specific pricing

### API Changes

- `fetchClientSecret()` now accepts `pricingTierId` parameter
- Checkout flow updated to handle tier-specific payments
- Payment records now track which tier was selected

## Future Enhancements

- Dynamic pricing based on demand
- Discount codes per tier
- Group pricing discounts
- Real-time availability updates
- Analytics on tier performance

## Group pricing
- Implement tickets system
- User has access to all of their tickets and is able to distribute them to other users
- Distribution should send an email link with their ticket id to create an account, and when the ticket id is consumed and linked to another user that ticket can no longer be used
- will need to update the logic for checking if users have access to paid events
- For migration purposes, should create tickets for existing "paid" participants to ensure they can continue to access the content they paid for