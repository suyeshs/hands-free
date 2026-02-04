# Migration Scripts

## Coorg Food Company Migration

Migrate `coorg-food-company-6163` tenant from v1.0 to current system.

### Quick Start

```bash
# Run migration
bun run migrate:coorg
```

### Prerequisites

1. **v1.0 Database**: Ensure `pos.db` exists in project directory
2. **Bun Installed**: Migration script uses Bun runtime
3. **Backup Space**: ~50-100MB free space for backups

### What Happens

1. ✅ Exports all sales data from v1.0 database
2. ✅ Creates automatic backups (database + JSON)
3. ✅ Transforms sales to structured format
4. ✅ Calculates taxes (2.5% CGST + 2.5% SGST)
5. ✅ Imports staff accounts with credentials
6. ✅ Validates data integrity
7. ✅ Archives old database

### Output Files

- `pos-v1-backup-{timestamp}.db` - Original database backup
- `migration-export-{timestamp}.json` - Full data export (JSON)
- `guanix.db` - New database with migrated data
- `pos-v1-archive-{timestamp}.db` - Old database (after commit)

### Documentation

See `../COORG_MIGRATION_GUIDE.md` for complete guide including:
- Detailed migration process
- Troubleshooting steps
- Validation checks
- Post-migration steps
- FAQ

### Support

If migration fails:
1. Check console logs for error details
2. Review `migration-export-{timestamp}.json`
3. Verify `pos-v1-backup-{timestamp}.db` was created
4. Original database is NEVER modified until validation passes

### Alternative Methods

**Via UI:**
```bash
bun run dev
# Navigate to http://localhost:5173/#/coorg-migration
```

**Programmatically:**
```typescript
import { runFullMigration } from '../src/services/coorgMigrationService';

const result = await runFullMigration((progress) => {
  console.log(`${progress.step}: ${progress.message} (${progress.progress}%)`);
});
```
