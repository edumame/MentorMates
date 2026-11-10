// Local-only fixture: draft event reads require the service key, like RLS.
import { createServer } from 'node:http';
const event = {
  event_id: '11111111-1111-4111-8111-111111111111',
  slug: 'draft-invite-regression',
  event_name: 'Draft Invitation Regression',
  event_blurb: 'Private draft details',
  visibility: 'draft',
  external_url: 'https://example.test/external',
  external_redirect_enabled: true,
};
createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') return response.end();
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/health') return response.end('{}');
  if (url.pathname.startsWith('/auth/')) {
    response.statusCode = 401;
    return response.end(JSON.stringify({ message: 'Signed out', code: 'session_not_found' }));
  }
  if (url.pathname === '/rest/v1/events') {
    const service = request.headers.apikey === 'invite-test-service-key';
    const matches = url.searchParams.get('event_id') === `eq.${event.event_id}` ||
      url.searchParams.get('slug') === `eq.${event.slug}` ||
      url.searchParams.get('or')?.includes(event.event_id);
    if (service && matches) {
      const fields = url.searchParams.get('select');
      const selected = fields && fields !== '*' ? Object.fromEntries(
        fields.split(',').map(field => field.trim()).filter(field => field in event).map(field => [field, event[field]])
      ) : event;
      return response.end(JSON.stringify(String(request.headers.accept).includes('object') ? selected : [selected]));
    }
    // .single()/.maybeSingle() requests use object responses.
    if (String(request.headers.accept).includes('object')) {
      response.statusCode = 406;
      return response.end(JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'No rows' }));
    }
  }
  return response.end('[]');
}).listen(54329, '127.0.0.1', () => console.log('Invite fixture listening on 54329'));
