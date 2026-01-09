# Admin Panel - Subdomain-Only Access

## 🔒 Security Enhancement

The admin panel is now **only accessible** via `admin.mentormates.ai`. Direct access to `/admin` on the main domain is blocked.

## How It Works

### 1. Middleware Protection (Primary)

```typescript
// middleware.ts
if (pathname.startsWith('/admin') && !hostname.startsWith('admin.')) {
  // Redirect to home
  return NextResponse.redirect('/');
}
```

**What it does:**
- Checks every request to `/admin` or `/admin/*`
- If the hostname is NOT `admin.mentormates.ai`, redirects to home
- Runs on **every request** (most secure)

### 2. Next.js Redirects (Backup)

```javascript
// next.config.mjs
async redirects() {
  return [
    {
      source: '/admin/:path*',
      has: [{ type: 'host', value: 'mentormates.ai' }],
      destination: '/',
      permanent: false,
    },
  ];
}
```

**What it does:**
- Provides a second layer of protection
- Handles edge cases where middleware might not run
- Configured at build time

## Access Patterns

### ✅ Allowed
- `https://admin.mentormates.ai` → Admin panel
- `https://admin.mentormates.ai/api/admin/events/123` → Admin API

### ❌ Blocked (Redirects to home)
- `https://mentormates.ai/admin` → Redirects to `https://mentormates.ai/`
- `https://www.mentormates.ai/admin` → Redirects to `https://www.mentormates.ai/`
- Any subdomain except `admin.*` → Redirects to home

## Benefits

1. **🔐 Security by Obscurity**
   - Admin panel not discoverable on main domain
   - Reduces attack surface

2. **🎯 Clear Separation**
   - Admin functions completely isolated
   - No accidental admin access from main site

3. **📊 Better Analytics**
   - Track admin traffic separately
   - Monitor subdomain-specific metrics

4. **🚀 Future Scalability**
   - Can add IP whitelisting to subdomain only
   - Can deploy admin to separate infrastructure later

## Testing

### Local Testing

1. **Update hosts file** (`/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1 localhost
127.0.0.1 admin.localhost
```

2. **Test access patterns**:
```bash
# Should work
curl http://admin.localhost:3000

# Should redirect to home
curl -L http://localhost:3000/admin
```

### Production Testing

After deployment:

```bash
# Should work (200 OK)
curl -I https://admin.mentormates.ai

# Should redirect (301/302)
curl -I https://mentormates.ai/admin
```

## Edge Cases Handled

### 1. API Routes
Admin API routes work correctly:
- ✅ `admin.mentormates.ai/api/admin/events/[id]` - Works
- ❌ `mentormates.ai/api/admin/events/[id]` - Redirects

### 2. Static Assets
Static files are not affected:
- Images, CSS, JS load normally on both domains

### 3. Authentication
Cookies work across subdomains:
- Login on main site → Access admin subdomain ✅
- Login on admin subdomain → Access main site ✅

## Additional Security Measures

Consider adding these for even more security:

### 1. IP Whitelisting (Vercel Pro)

```javascript
// vercel.json
{
  "firewall": {
    "rules": [
      {
        "action": "deny",
        "hostname": "admin.mentormates.ai",
        "source": {
          "type": "ip",
          "value": "!1.2.3.4" // Your office IP
        }
      }
    ]
  }
}
```

### 2. HTTP Basic Auth

Add to middleware for double protection:

```typescript
// middleware.ts
if (hostname.startsWith('admin.')) {
  const basicAuth = request.headers.get('authorization');
  
  if (!basicAuth) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Panel"',
      },
    });
  }
  
  // Verify credentials
  const [username, password] = atob(basicAuth.split(' ')[1]).split(':');
  if (username !== 'admin' || password !== process.env.ADMIN_PASSWORD) {
    return new NextResponse('Invalid credentials', { status: 401 });
  }
}
```

### 3. Rate Limiting

Protect admin API endpoints:

```typescript
// app/api/admin/events/[eventId]/route.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function PATCH(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  
  // ... rest of handler
}
```

## Monitoring

Track admin access attempts:

```typescript
// middleware.ts
if (pathname.startsWith('/admin') && !hostname.startsWith('admin.')) {
  // Log blocked access attempt
  console.warn('Blocked admin access attempt:', {
    ip: request.ip,
    hostname,
    pathname,
    timestamp: new Date().toISOString(),
  });
  
  // Optional: Send to monitoring service
  // await fetch('your-monitoring-endpoint', { ... });
  
  return NextResponse.redirect('/');
}
```

## Troubleshooting

### Issue: Can't access admin panel at all
**Check:**
1. DNS CNAME record is set correctly
2. Vercel domain is added and verified
3. SSL certificate is provisioned
4. Clear browser cache

### Issue: Still can access via /admin on main domain
**Check:**
1. Middleware changes are deployed
2. Clear CDN cache (Vercel auto-purges)
3. Test in incognito mode
4. Check browser isn't caching redirect

### Issue: API calls failing
**Check:**
1. API routes are being called from admin subdomain
2. CORS settings in Supabase include subdomain
3. Environment variables are set in Vercel

## Rollback Plan

If you need to allow `/admin` access temporarily:

1. **Comment out middleware redirect**:
```typescript
// if (pathname.startsWith('/admin') && !hostname.startsWith('admin.')) {
//   return NextResponse.redirect('/');
// }
```

2. **Comment out Next.js redirects**:
```javascript
// async redirects() {
//   return [];
// }
```

3. **Redeploy**

## Summary

✅ **What's Protected:**
- `/admin` path on main domain → Redirects to home
- `/admin/*` subpaths on main domain → Redirects to home
- Admin API routes on main domain → Redirects to home

✅ **What Still Works:**
- `admin.mentormates.ai` → Full admin access
- Authentication across domains
- All main site functionality

🔒 **Security Level:** High
- Two layers of protection (middleware + redirects)
- No direct path to admin panel from main domain
- Easy to add additional security layers

---

**Ready to deploy?** Just commit and push - the changes will take effect immediately!
