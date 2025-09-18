-- 1. Add bundle support to user_event_payments
ALTER TABLE user_event_payments 
ADD COLUMN tickets_quantity INTEGER DEFAULT 1,
ADD COLUMN is_bundle BOOLEAN DEFAULT false;

-- 2. Create enum type for ticket status
CREATE TYPE ticket_status_enum AS ENUM ('unassigned', 'assigned', 'used', 'transferred');

-- 3. Create event_tickets table as the main participation tracker
CREATE TABLE event_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES user_event_payments(id) ON DELETE CASCADE,
    purchased_by_user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    assigned_to_user_id UUID REFERENCES user_profiles(uid) ON DELETE SET NULL,
    assigned_to_email TEXT, -- For inviting people who don't have accounts yet
    ticket_status ticket_status_enum DEFAULT 'unassigned',
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_event_tickets_event_id ON event_tickets(event_id);
CREATE INDEX idx_event_tickets_payment_id ON event_tickets(payment_id);
CREATE INDEX idx_event_tickets_assigned_to ON event_tickets(assigned_to_user_id);
CREATE INDEX idx_event_tickets_purchased_by ON event_tickets(purchased_by_user_id);
CREATE INDEX idx_event_tickets_status ON event_tickets(ticket_status);