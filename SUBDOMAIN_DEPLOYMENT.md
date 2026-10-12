# Deploying Admin Page as Subdomain (admin.mentormates.ai)

## Option 1: Vercel Subdomain with Rewrites (Recommended ⭐)

This is the **easiest approach** - keeps everything in one deployment but accessible via subdomain.

### Steps:

1. **Update `next.config.mjs`** to add rewrites for the subdomain:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      new URL("https://lpxqfwyqandsortecbvu.supabase.co/**"),
      new URL("https://moinycvhmmzjjtvqijzw.supabase.co/**"),
      new URL("https://zqlopmbodkxlaunmkveo.supabase.co/**"),
      new URL("https://nsxcypmjpizdjxrdncpe.supabase.co/**"),
      new URL("https://clinicalmindai.stanford.edu"),
    ],
  },
  skipTrailingSlashRedirect: true,
  serverExternalPackages: [
    "@stream-io/node-sdk",
    "ws",
  ],
  
  // Add this for subdomain routing
  async rewrites() {
    return {
      beforeFiles: [
        // Rewrite admin subdomain to /admin path
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'admin.mentormates.ai',
            },
          ],
          destination: '/admin/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
```

2. **Configure DNS** (in your domain registrar - e.g., Cloudflare, Namecheap):
   - Add a CNAME record:
     - **Name**: `admin`
     - **Value**: `cname.vercel-dns.com` (or your Vercel domain)
     - **TTL**: Auto

3. **Add Domain in Vercel Dashboard**:
   - Go to your project → Settings → Domains
   - Add `admin.mentormates.ai`
   - Vercel will automatically provision SSL certificate

4. **Done!** 🎉
   - Main site: `mentormates.ai`
   - Admin panel: `admin.mentormates.ai`
   - Same deployment, same codebase

### Pros:
✅ Single deployment (easier to maintain)
✅ Shared authentication/session
✅ No code duplication
✅ Automatic SSL
✅ Fast deployment

### Cons:
❌ Admin and main site share same resources
❌ Can't scale independently

---

## Option 2: Separate Vercel Project (Better Isolation)

Deploy the admin section as a completely separate Next.js app.

### Steps:

1. **Create a new Next.js project** for admin:

```bash
npx create-next-app@latest mentormates-admin
cd mentormates-admin
```

2. **Copy admin-related files**:
   - Copy `/app/admin/page.tsx` → `/app/page.tsx`
   - Copy `/app/api/admin/` → `/app/api/`
   - Copy shared components, types, and utilities
   - Copy Supabase configuration

3. **Update environment variables** in the new project:
   - Same Supabase credentials
   - Same authentication setup

4. **Deploy to Vercel**:
```bash
vercel --prod
```

5. **Configure DNS**:
   - Point `admin.mentormates.ai` to the new Vercel deployment

### Pros:
✅ Complete isolation
✅ Can scale independently
✅ Separate deployment pipeline
✅ Better security (can add additional layers)

### Cons:
❌ Code duplication
❌ Need to maintain two projects
❌ More complex deployment

---

## Option 3: Middleware-Based Routing (Advanced)

Use Next.js middleware to handle subdomain routing dynamically.

### Steps:

1. **Update `middleware.ts`**:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Check if it's the admin subdomain
  if (hostname.startsWith('admin.')) {
    // Rewrite to /admin path
    const url = request.nextUrl.clone();
    
    // If already on /admin path, continue
    if (url.pathname.startsWith('/admin')) {
      return NextResponse.next();
    }
    
    // Rewrite root to /admin
    if (url.pathname === '/') {
      url.pathname = '/admin';
      return NextResponse.rewrite(url);
    }
    
    // Rewrite all other paths to /admin/*
    url.pathname = `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  
  // Continue with existing middleware logic
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

2. **Configure DNS** (same as Option 1)

3. **Add domain in Vercel** (same as Option 1)

### Pros:
✅ Single deployment
✅ Dynamic routing
✅ Flexible configuration
✅ Can add more subdomains easily

### Cons:
❌ More complex middleware
❌ Potential performance impact

---

## 🏆 **Recommendation**

For your use case, I recommend **Option 1** (Vercel Subdomain with Rewrites) because:

1. ✅ **Simplest to implement** - just update `next.config.mjs`
2. ✅ **Shared authentication** - admins stay logged in
3. ✅ **Single codebase** - easier to maintain
4. ✅ **Fast** - no additional complexity

If you need complete isolation or expect heavy admin traffic, go with **Option 2**.

---

## 🔒 Additional Security Considerations

Since this is an admin panel, consider adding:

1. **IP Whitelisting** (Vercel Pro):
   - Settings → Firewall → IP Allowlist
   - Only allow specific IPs to access admin subdomain

2. **Additional Authentication Layer**:
   - Add HTTP Basic Auth via middleware for admin subdomain
   - Require 2FA for admin users

3. **Rate Limiting**:
   - Implement rate limiting on admin API routes
   - Use Vercel Edge Config or Upstash Redis

4. **Audit Logging**:
   - Log all admin actions (featured/approved changes)
   - Store in separate Supabase table

---

## 📝 Implementation Checklist

- [ ] Choose deployment approach
- [ ] Update `next.config.mjs` or create new project
- [ ] Configure DNS CNAME record
- [ ] Add domain in Vercel dashboard
- [ ] Test subdomain access
- [ ] Verify authentication works
- [ ] Test admin functionality
- [ ] Set up SSL certificate (automatic via Vercel)
- [ ] Add security measures (optional)
- [ ] Update documentation

---

## 🚀 Quick Start (Option 1)

Want to implement Option 1 right now? I can:
1. Update your `next.config.mjs` with the rewrite rules
2. Provide DNS configuration instructions
3. Create a deployment guide

Let me know if you'd like me to implement any of these options!
