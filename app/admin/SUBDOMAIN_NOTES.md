# Admin Subdomain - Technical Notes

## ✅ Cookie & Authentication

Your Supabase configuration is already set up correctly for subdomain authentication! 

### How It Works

The `@supabase/ssr` package automatically handles cookie domain settings:
- Cookies are set with domain `.mentormates.ai` (note the leading dot)
- This allows cookies to be shared across:
  - `mentormates.ai`
  - `admin.mentormates.ai`
  - `www.mentormates.ai`
  - Any other subdomain

### What This Means

✅ **Users stay logged in** when navigating between:
- Main site → Admin panel
- Admin panel → Main site

✅ **No additional configuration needed** for authentication

## 🔧 Environment Variables

Make sure these are set in your Vercel project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

These will work for both the main domain and subdomain.

## 🌐 CORS Configuration

If you're using Supabase Auth, ensure your Supabase project allows both domains:

1. Go to Supabase Dashboard
2. Authentication → URL Configuration
3. Add to **Site URL**:
   - `https://mentormates.ai`
   - `https://admin.mentormates.ai`
4. Add to **Redirect URLs**:
   - `https://mentormates.ai/**`
   - `https://admin.mentormates.ai/**`

## 🔒 Security Considerations

### Current Setup
- ✅ Admin check via `is_admin_user` RPC
- ✅ Server-side authentication
- ✅ API endpoint protection

### Recommended Additions

1. **Rate Limiting** on admin API endpoints:
```typescript
// app/api/admin/events/[eventId]/route.ts
// Add rate limiting middleware
```

2. **Audit Logging** for admin actions:
```sql
-- Create audit log table
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  event_id UUID REFERENCES events(event_id),
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. **IP Whitelisting** (Vercel Pro feature):
   - Restrict admin subdomain to specific IPs
   - Settings → Firewall → IP Allowlist

## 📊 Monitoring

Consider adding:

1. **Admin Action Logging**:
```typescript
// Log every featured/approved change
await supabase.from('admin_audit_log').insert({
  admin_id: user.id,
  action: 'update_event_status',
  event_id: eventId,
  changes: { featured, approved }
});
```

2. **Analytics**:
   - Track admin page views
   - Monitor API endpoint usage
   - Alert on unusual activity

## 🚀 Performance

The subdomain rewrite adds minimal overhead:
- ~1-2ms latency for rewrite
- Same server-side rendering
- No additional network hops

## 🧪 Testing Locally

To test subdomain routing locally:

1. **Update `/etc/hosts` (Mac/Linux)** or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 admin.localhost
```

2. **Run dev server**:
```bash
npm run dev
```

3. **Access**:
- Main: `http://localhost:3000`
- Admin: `http://admin.localhost:3000`

## 📝 Deployment Checklist

Before going live:

- [ ] DNS CNAME record added
- [ ] Domain added in Vercel
- [ ] SSL certificate provisioned
- [ ] Supabase URL configuration updated
- [ ] Test authentication flow
- [ ] Test admin functionality
- [ ] Verify API endpoints work
- [ ] Check mobile responsiveness
- [ ] Monitor for errors

## 🐛 Common Issues & Fixes

### Issue: "Invalid Host Header"
**Fix**: Vercel automatically handles this. If using custom server, add to allowed hosts.

### Issue: Cookies not working
**Fix**: Check Supabase URL configuration includes subdomain.

### Issue: 404 on subdomain
**Fix**: Verify `next.config.mjs` rewrites are deployed and DNS is propagated.

### Issue: Redirect loops
**Fix**: Check middleware doesn't conflict with rewrites.

## 📚 Additional Resources

- [Next.js Rewrites Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Need Help?** Check the main `SUBDOMAIN_DEPLOYMENT.md` for step-by-step instructions.
