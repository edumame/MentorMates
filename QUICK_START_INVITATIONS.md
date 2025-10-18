# Quick Start Guide: Invitation & Notification System

## ✅ What's Ready

The database schema is **complete and production-ready**:
- ✅ 2 migration files created
- ✅ TypeScript types updated
- ✅ Build passes successfully
- ✅ Full documentation provided

## 🚀 Next Steps (In Order)

### Step 1: Apply Migrations (5 minutes)

Run these migrations in your Supabase project:

```bash
# Option A: Using Supabase CLI (recommended)
supabase db push

# Option B: Run manually in Supabase Dashboard SQL Editor
# Execute: supabase/migrations/20251018_create_notifications_table.sql
# Execute: supabase/migrations/20251018_create_project_invites_table.sql

# Option C: If using the setup script
npm run setup-db
```

After running migrations, verify in Supabase:
- Go to Table Editor → should see `notifications` and `project_invites` tables

### Step 2: Update Existing Invite API (30 minutes)

**File**: `app/api/projects/invite-teammate/route.ts`

**Change**: Instead of just sending email, create a record in `project_invites` table.

**Quick implementation**:
```typescript
// Add this after line 92 (after getting invite hash)
const { data: invite } = await supabase
  .from('project_invites')
  .insert({
    project_id: project.id,
    event_id: project.event_id,
    invitee_email: email.trim().toLowerCase(),
    invited_by_user_id: auth.user.id,
    invited_by_name: inviterName,
    invite_token: hash,
    status: 'pending',
  })
  .select()
  .single();

// The trigger automatically creates a notification!
```

### Step 3: Show Pending Invites on Projects Page (1 hour)

**File**: `app/(users)/projects/page.tsx`

**Add at top of page component**:
```typescript
// Fetch pending invites
const { data: pendingInvites } = await supabase
  .from('project_invites')
  .select(`
    *,
    projects (*),
    events (*)
  `)
  .eq('invitee_email', user.email)
  .eq('status', 'pending');
```

**Add this section before existing projects**:
```tsx
{pendingInvites?.length > 0 && (
  <section className="mb-8">
    <h2 className="text-2xl font-bold mb-4">Draft Projects</h2>
    <div className="grid gap-4">
      {pendingInvites.map((invite) => (
        <Card key={invite.id}>
          <Badge variant="warning">Pending invite</Badge>
          <h3>{invite.projects.project_name}</h3>
          <p>Invited by {invite.invited_by_name}</p>
          <Button onClick={() => handleAcceptInvite(invite.id)}>
            Accept & Open
          </Button>
        </Card>
      ))}
    </div>
  </section>
)}
```

### Step 4: Create Accept/Decline Functions (30 minutes)

**In the same file**, add these functions:

```typescript
async function handleAcceptInvite(inviteId: string) {
  try {
    // 1. Update invite status
    await supabase
      .from('project_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);
    
    // 2. Get invite details
    const { data: invite } = await supabase
      .from('project_invites')
      .select('*, projects(*)')
      .eq('id', inviteId)
      .single();
    
    // 3. Add to project teammates
    const teammates = invite.projects.teammates || [];
    await supabase
      .from('projects')
      .update({ teammates: [...teammates, user.email] })
      .eq('id', invite.project_id);
    
    // 4. Join event if needed
    if (invite.event_id) {
      await supabase
        .from('user_event_roles')
        .upsert({
          user_id: user.id,
          event_id: invite.event_id,
          role: 'participant'
        });
    }
    
    // 5. Redirect to project
    router.push(`/projects/${invite.project_id}`);
  } catch (error) {
    console.error('Error accepting invite:', error);
  }
}
```

## 📚 Documentation Files

- **`DATABASE_SCHEMA_NOTIFICATIONS_AND_INVITES.md`** - Complete reference
- **`INVITATION_SYSTEM_IMPLEMENTATION_SUMMARY.md`** - Full implementation guide
- **`supabase/COMMON_QUERIES.sql`** - 30+ example queries

## 🧪 Testing Your Implementation

1. **Create an invite** (as project lead):
   - Go to your project
   - Invite a teammate
   - Check `project_invites` table in Supabase - should see new row

2. **View as invitee** (log in as invited user):
   - Go to `/projects`
   - Should see "Draft Projects" section
   - Should see your project with "Pending invite" badge

3. **Accept invite**:
   - Click "Accept & Open"
   - Should be redirected to project page
   - Check `projects.teammates` - should include your email
   - Check `project_invites.status` - should be 'accepted'

## 📊 Check Your Database

After applying migrations, run these queries in Supabase SQL Editor:

```sql
-- See all invites
SELECT * FROM project_invites ORDER BY created_at DESC LIMIT 10;

-- See all notifications  
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check if triggers are working
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table IN ('project_invites', 'notifications');
```

## 🐛 Troubleshooting

**Problem**: Migrations fail
- **Solution**: Check if tables already exist. Drop them first if needed.

**Problem**: No notifications created when invite is created
- **Solution**: Check if trigger exists: `trigger_create_project_invite_notification`

**Problem**: RLS blocking queries
- **Solution**: Check if user's email matches `invitee_email` in query

**Problem**: Types not recognized in TypeScript
- **Solution**: Restart TypeScript server in your IDE

## 💡 Pro Tips

1. **Start small**: Get the basic flow working first (create invite → view invite → accept)
2. **Use the SQL examples**: Reference `supabase/COMMON_QUERIES.sql` for queries
3. **Check RLS policies**: If queries aren't working, RLS might be blocking them
4. **Test with two accounts**: Use two different browsers/sessions to test the full flow

## 🎯 Success Criteria

You'll know it's working when:
- ✅ Creating an invite adds row to `project_invites` table
- ✅ Notification automatically created when invite is created
- ✅ Invited user sees project in "Draft Projects" section
- ✅ Accepting invite adds user to project and event
- ✅ After accepting, user is redirected to project page

---

**Need help?** Check the full documentation in `INVITATION_SYSTEM_IMPLEMENTATION_SUMMARY.md`

**Total estimated time to get basic flow working**: 2-3 hours
