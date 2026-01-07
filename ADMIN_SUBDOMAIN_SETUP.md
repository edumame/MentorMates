# Admin Subdomain Setup Guide

## ✅ What's Already Done

I've updated `next.config.mjs` to support subdomain routing for `admin.mentormates.ai`. (Commented out for now)

## 🚀 Next Steps to Deploy

### Step 1: DNS Configuration

Add a CNAME record in your DNS provider (Cloudflare, Namecheap, etc.):

```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: Auto (or 3600)
```

**Alternative**: If you're using a different hosting provider, point to your main domain:
```
Type: CNAME
Name: admin
Value: mentormates.ai
```

### Step 2: Add Domain in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `admin.mentormates.ai`
5. Click **Add**
6. Vercel will automatically:
   - Verify DNS configuration
   - Provision SSL certificate
   - Configure routing

### Step 3: Deploy

```bash
# Commit the changes
git add next.config.mjs
git commit -m "Add admin subdomain routing"
git push

# Vercel will auto-deploy if connected to Git
# Or manually deploy:
vercel --prod
```

### Step 4: Test

Once deployed and DNS propagates (5-30 minutes):

1. Visit `https://admin.mentormates.ai`
2. Should redirect to login if not authenticated
3. Login as an admin user
4. Should see the admin event management page

## 🔍 How It Works

```
User visits: admin.mentormates.ai
             ↓
Next.js detects subdomain via rewrites
             ↓
Internally routes to: /admin
             ↓
Renders: app/admin/page.tsx
```

The URL stays as `admin.mentormates.ai` but internally it's serving `/admin`.

## 🎯 URLs After Setup

- **Main Site**: `https://mentormates.ai`
- **Admin Panel**: `https://admin.mentormates.ai`
- **Admin API**: `https://admin.mentormates.ai/api/admin/events/[eventId]`
- **Direct Access**: `https://mentormates.ai/admin` (still works)

## 🔒 Optional: Restrict Direct Access

If you want to force users to use the subdomain only, add this middleware:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Redirect /admin on main domain to subdomain
  if (!hostname.startsWith('admin.') && pathname.startsWith('/admin')) {
    return NextResponse.redirect(
      new URL(pathname.replace('/admin', ''), 'https://admin.mentormates.ai')
    );
  }
  
  // ... rest of your middleware
}
```

## 🐛 Troubleshooting

### DNS not propagating
- Wait 5-30 minutes
- Check DNS with: `nslookup admin.mentormates.ai`
- Clear browser cache

### SSL certificate issues
- Vercel auto-provisions SSL
- May take a few minutes
- Check Vercel dashboard → Domains → SSL status

### 404 errors
- Verify `next.config.mjs` changes are deployed
- Check Vercel deployment logs
- Ensure DNS CNAME points to correct value

### Authentication issues
- Cookies should work across subdomains
- Check Supabase site URL configuration
- May need to update cookie domain settings

## 📊 Monitoring

After deployment, monitor:
- Vercel Analytics for traffic
- Supabase logs for admin actions
- Consider adding audit logging for admin changes

## 🎉 You're Done!

Once DNS propagates and Vercel configures everything, your admin panel will be live at `admin.mentormates.ai`!
