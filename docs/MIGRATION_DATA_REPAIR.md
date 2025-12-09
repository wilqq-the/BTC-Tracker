# Migration Data Repair Guide

## The Issue

Upgrading from versions prior to v0.6.6 could result in:
- Transactions appearing to be missing (not visible in the UI)
- User losing admin privileges
- Settings not loading correctly

This happened because the v0.6.6 migration system could incorrectly run database migrations that reset certain data fields.

## Who Is Affected?

Users who:
1. Installed BTC Tracker before v0.6.6
2. Upgraded to v0.6.6 or later
3. Had existing transactions in their database

## Automatic Repair

Starting from v0.6.8, the migration system automatically detects and repairs this issue for **single-user instances**.

You'll see this in the logs:
```
[FIX] Assigning X orphaned transactions to user 1...
[OK] Orphaned data assigned to user
[FIX] Setting first user as admin...
[OK] Admin status restored
```

## Multi-User Instances

If you have multiple users, automatic repair is **not performed** to avoid assigning transactions to the wrong user. You'll see:

```
[WARN] ATTENTION: Data repair needed but multiple users detected!
[WARN] Found X transactions with no owner and Y users
[WARN] Cannot auto-assign - manual intervention required
```

### Manual Repair for Multi-User

1. **Identify the issue:**
```bash
# Check orphaned transactions
sqlite3 /path/to/bitcoin-tracker.db "SELECT COUNT(*) FROM bitcoin_transactions WHERE user_id IS NULL;"

# See all users
sqlite3 /path/to/bitcoin-tracker.db "SELECT id, email, is_admin FROM users;"
```

2. **If you know which user owns the transactions:**
```bash
# Assign all orphaned transactions to user ID X
sqlite3 /path/to/bitcoin-tracker.db "UPDATE bitcoin_transactions SET user_id = X WHERE user_id IS NULL;"

# Also fix other tables
sqlite3 /path/to/bitcoin-tracker.db "UPDATE app_settings SET user_id = X WHERE user_id IS NULL;"
sqlite3 /path/to/bitcoin-tracker.db "UPDATE portfolio_summary SET user_id = X WHERE user_id IS NULL;"
```

3. **Restore admin status:**
```bash
sqlite3 /path/to/bitcoin-tracker.db "UPDATE users SET is_admin = 1 WHERE id = X;"
```

### If You Have a Backup

The safest option is to restore from a backup taken before the upgrade.

## Prevention

This issue has been fixed in v0.6.7+. The migration system now:
1. Properly detects legacy databases
2. Baselines all migrations before running new ones
3. Uses `prisma db push` as a safety net
4. Automatically repairs single-user data issues

## Need Help?

If you're still experiencing issues:
1. Open an issue on GitHub with your logs
2. Include the output of:
   ```bash
   sqlite3 /path/to/bitcoin-tracker.db "SELECT id, email, is_admin FROM users;"
   sqlite3 /path/to/bitcoin-tracker.db "SELECT user_id, COUNT(*) FROM bitcoin_transactions GROUP BY user_id;"
   ```

