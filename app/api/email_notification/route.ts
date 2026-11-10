import { createHash } from "node:crypto";
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { getClaimTicketEmailTemplate } from '@/lib/email_templates/claim-ticket';

const schema = z.object({
  requestId: z.string().uuid(),
  eventId: z.string().uuid().optional(), ticketId: z.string().uuid().optional(),
  to: z.string().email(), bcc: z.array(z.string().email()).max(500).default([]),
  cc: z.array(z.string().email()).max(500).default([]),
  subject: z.string().min(1).max(250), html: z.string().min(1).max(100_000),
});
export async function POST(request: Request) {
  try {
    const session = await createSupabaseClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid email request' }, { status: 400 });
    const body = parsed.data;
    const service = createSupabaseServiceClient();
    let recipients: string[];
    let subject = body.subject, html = body.html;
    if (body.ticketId) {
      const { data: ticket, error } = await service.from('event_tickets').select('id,event_id,purchased_by_user_id,assigned_to_email').eq('id', body.ticketId).maybeSingle();
      if (error) throw error;
      if (!ticket || ticket.purchased_by_user_id !== user.id || ticket.assigned_to_email?.toLowerCase() !== body.to.toLowerCase()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { data: event } = await service.from('events').select('event_name').eq('event_id', ticket.event_id).single();
      const template = getClaimTicketEmailTemplate(event?.event_name || 'Event', ticket.id, 'A ticket holder');
      subject = template.subject; html = template.html; recipients = [body.to];
    } else {
      if (!body.eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });
      const { data: allowed, error } = await session.rpc('is_event_organizer_or_owner', { p_event_id: body.eventId, p_user_id: user.id });
      const { data: admin, error: adminError } = await session.rpc('is_admin_user', { user_id: user.id });
      if (error || adminError) throw new Error('Permission lookup failed');
      if (!allowed && !admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      recipients = [...new Set((body.bcc.length || body.cc.length ? [...body.bcc, ...body.cc] : [body.to]).map(x => x.toLowerCase()))];
      if (recipients.length > 500) return NextResponse.json({ error: 'Too many recipients' }, { status: 400 });
      const { data: members, error: memberError } = await service.from('user_event_roles').select('user_profiles!user_event_roles_user_id_fkey1!inner(email)').eq('event_id', body.eventId).in('user_profiles.email', recipients);
      if (memberError) throw memberError;
      const emails = new Set((members || []).flatMap(row => {
        const profiles = row.user_profiles as unknown as { email?: string } | { email?: string }[];
        return (Array.isArray(profiles) ? profiles : [profiles]).map(p => p?.email?.toLowerCase());
      }));
      if (recipients.some(email => !emails.has(email))) return NextResponse.json({ error: 'Recipients must belong to the event' }, { status: 403 });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Provider batches are bounded; each retry uses the same content-bound key.
    recipients.sort();
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100).map(to => ({ from: NOTIFICATIONS_EMAIL_FROM, to, subject, html }));
      const key = createHash('sha256').update(JSON.stringify([user.id, body.requestId, offset, batch])).digest('hex');
      const { error } = await resend.batch.send(batch, { idempotencyKey: key });
      if (error) return NextResponse.json({ error: 'Some emails failed to send', sent: offset, retryWithSameRequestId: true }, { status: 422 });
    }
    return NextResponse.json({ message: 'Email sent successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
