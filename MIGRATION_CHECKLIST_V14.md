# V14 Migration Checklist

## PreDeploy Verification

### ✅ Code Review
- [ ] Read `V14_SUMMARY.md` for overview
- [ ] Review `IMPLEMENTATION_GUIDE_V14.md` for integration patterns
- [ ] Check `supabase_migration_v14.sql` for schema changes
- [ ] Verify all new components import paths

### ✅ Local Testing
- [ ] Install dependencies (if any new ones)
- [ ] Run `npm run build` to check TypeScript
- [ ] Run `npm run lint` to check code style
- [ ] Start dev server `npm run dev`

---

## Phase 1: Database Migration

### Step 1.1 - Backup Current Database
```bash
# In Supabase Dashboard:
# 1. Go to Backups
# 2. Click "Request a backup now"
# 3. Wait for backup to complete
```

### Step 1.2 - Apply V14 Migration
```sql
-- In Supabase SQL Editor:
-- 1. Open SQL Editor
-- 2. Copy entire content of supabase_migration_v14.sql
-- 3. Paste into editor
-- 4. Click "Run" (carefully!)
-- 5. Wait for completion, check for errors
```

**Verify migration succeeded:**
```sql
-- Check new column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='contacts' 
AND column_name='primary_organization_id';

-- Check RPC functions created
SELECT proname FROM pg_proc 
WHERE proname LIKE 'search_contacts_by_org%';

-- Check view created
SELECT table_name FROM information_schema.tables 
WHERE table_name='activities_unified';
```

### Step 1.3 - Verify RLS Policies
```sql
-- Ensure all new tables have RLS enabled
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname='public' 
AND tablename IN ('activity_contacts', 'task_contacts', 'activities')
AND NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename
);
-- Should return empty if all have RLS
```

---

## Phase 2: Deploy Code Changes

### Step 2.1 - Update Pull Request
```bash
# Create feature branch
git checkout -b feat/v14-crmrefactor

# Add all V14 files
git add supabase_migration_v14.sql
git add lib/crm/types.ts
git add lib/crm/labels.ts
git add app/protected/components/org-contact-picker.tsx
git add app/protected/components/unified-activity-modal.tsx
git add app/protected/components/contact-org-assignment-warning.tsx
git add app/protected/actions/unified-activity-actions.ts
git add app/api/search/contacts-by-org/route.ts
git add CRM_CONTEXT_CLAUDE.md
git add IMPLEMENTATION_GUIDE_V14.md
git add V14_SUMMARY.md

# Commit
git commit -m "feat(v14): unified activities, primary org, multi-service support"

# Push
git push origin feat/v14-crmrefactor

# Create PR and get reviewed
```

### Step 2.2 - Deploy to Staging
```bash
# After PR approval:
git checkout main
git pull origin main
git merge feat/v14-crmrefactor

# Deploy to staging (depends on your CI/CD)
# Example (adjust to your setup):
vercel deploy --prod --env=staging
```

### Step 2.3 - Test on Staging
```bash
# Test new components work
- [ ] Create a new activity (todo, meeting, recruitment_interview)
- [ ] Test activity with participants
- [ ] Test contact selection via OrgContactPicker
- [ ] Test ContactOrgAssignmentWarning appears for contacts without org
- [ ] Test API /api/search/contacts-by-org?org_id=...&query=...

# Test backward compatibility
- [ ] Old tasks still visible
- [ ] Old events still visible
- [ ] Deals still load
- [ ] Contacts still searchable
```

---

## Phase 3: Production Deployment

### Step 3.1 - Create Release Notes
```markdown
# V14 Release - CRM Optimizations

## 🎉 What's New
- Unified Activities (tasks + events + activities merged)
- Primary Organization for Contacts  
- Multi-Service Deals (recruitment, CFO advisory)
- Smart Contact Pickers (Org → Contact)

## 📝 Migration Required
This release requires database migration V14. 
**Backup your database before deploying.**

## ✨ New Features
- UnifiedActivityModal for all activity types
- OrgContactPicker for intelligent organization/contact selection
- ContactOrgAssignmentWarning for incomplete contacts

## 🔄 Backward Compatibility
- Old tasks/events tables remain intact
- Existing functionality unaffected
- Migration from old to new types optional
```

### Step 3.2 - Production Deployment
```bash
# When ready (typically after staging validation):
# 1. Tag release
git tag -a v14.0.0 -m "V14: Unified Activities, Primary Org, Multi-Service"
git push origin v14.0.0

# 2. Deploy to production
# (depends on your CI/CD, e.g., vercel triggers on main push)
git checkout main
git merge feat/v14-crmrefactor
git push origin main

# If using Vercel, this auto-deploys
# If using other service, trigger deployment accordingly
```

### Step 3.3 - Post-Deployment Verification
```sql
-- In Supabase (verify data integrity)

-- 1. Check no data loss
SELECT COUNT(*) as total_activities FROM activities;
SELECT COUNT(*) as total_contacts FROM contacts;
SELECT COUNT(*) as total_deals FROM deals;

-- 2. Check RLS is still working
-- Try accessing as different auth users (should be filtered)

-- 3. Check indices are working
EXPLAIN ANALYZE 
SELECT * FROM activities 
WHERE activity_type = 'meeting' AND user_id = 'current-user-id';
-- Should show index usage
```

---

## Phase 4: Rollout to Team

### Step 4.1 - Team Communication
- [ ] Share release notes with team
- [ ] Post in Slack/Teams with migration summary
- [ ] Schedule demo of new features

### Step 4.2 - Documentation
- [ ] Team reads `IMPLEMENTATION_GUIDE_V14.md`
- [ ] Point out new components in codebase
- [ ] Explain when to use UnifiedActivityModal vs old components

### Step 4.3 - Deprecation Period (Optional)
```
Timeline:
- Day 0: V14 deployed
- Week 1-2: Old task-modal/event-modal still work (deprecated)
- Week 3: Remove old modals, migrate all usages
```

---

## Phase 5: Data Migration (Long-term, Optional)

### Step 5.1 - Migrate Old Tasks to Activities
```sql
-- Only if you want to consolidate old data
-- (Not required, old tasks still work)

SELECT migrate_tasks_to_activities('user-id-here'::UUID);
```

This converts old `tasks` → `activities` of type `'todo'`.

// Verify migration
```sql
SELECT COUNT(*) as migrated 
FROM activities 
WHERE activity_type = 'todo' AND is_legacy = true;
```

---

## 🆘 Troubleshooting

### Issue: Migration fails with "constraint already exists"
**Solution**: The migration script is idempotent. Run again. If error persists, check Supabase logs for details.

### Issue: New components not importing
**Solution**: Verify file paths are correct. Check TypeScript compilation with `npm run build`.

### Issue: RPC functions not found
**Solution**: Ensure migration was fully executed. Restart dev server with `npm run dev`.

### Issue: API route returns 404
**Solution**: Check that `app/api/search/contacts-by-org/route.ts` file exists. Restart server.

### Issue: Old tasks/events disappear
**Solution**: Migrations are additive. Old data remains. Check database directly to verify.

---

## ✅ Sign-off Checklist

- [ ] Migration applied successfully
- [ ] Code deployed to staging
- [ ] All tests pass (new components work)
- [ ] Backward compatibility verified
- [ ] Team briefed on changes
- [ ] Users can access application
- [ ] No critical errors in logs
- [ ] Release notes published

**Ready for production deployment!**

---

## 📞 Support

If issues arise, check:
1. `V14_SUMMARY.md` — overview of what changed
2. `IMPLEMENTATION_GUIDE_V14.md` — integration examples
3. Component JSDoc comments — inline documentation
4. Supabase logs — for DB errors
5. Next.js console — for API/component errors

**Questions?** Refer to CRM_CONTEXT_CLAUDE.md for architectural details.
