# Menu Sync Worker - Deployment Guide

## ✅ Deployed Successfully

**Worker URL:** https://filesearch-sync.suyesh.workers.dev

**Status:** Active
**Version:** 0576a27e-a3d0-4264-a365-dea9e4c1bdae
**Deploy Time:** 2026-01-28 09:26:15 UTC

---

## 🔗 Live Endpoints

### Health Check
```bash
curl https://filesearch-sync.suyesh.workers.dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "menu-sync",
  "timestamp": "2026-01-28T09:26:15.934Z"
}
```

---

### Check Sync Status
```bash
curl https://filesearch-sync.suyesh.workers.dev/status/coorg-food-company-6163
```

**Response:**
```json
{
  "success": true,
  "status": {
    "inSync": false,
    "lastSyncTime": null,
    "d1ItemCount": 45,
    "fileSearchItemCount": null,
    "errors": ["Never synced - initial sync required"],
    "needsSync": true,
    "tenantId": "coorg-food-company-6163"
  }
}
```

---

### Trigger Full Sync
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/full/coorg-food-company-6163
```

**What it does:**
1. Syncs D1 → KV (edge caching)
2. Syncs D1 → File Search (AI voice ordering)
3. Updates sync metadata in KV

---

### D1 to KV Sync Only
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/d1-to-kv/coorg-food-company-6163
```

---

### File Search Sync Only
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/coorg-food-company-6163
```

---

### Webhook for Auto-Sync
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "coorg-food-company-6163",
    "trigger": "pos_menu_update",
    "itemsChanged": 3
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Menu sync triggered",
  "tenantId": "coorg-food-company-6163",
  "trigger": "pos_menu_update"
}
```

> **Note:** Sync happens asynchronously in the background

---

### Batch Status Check
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/status/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tenantIds": ["tenant-1", "tenant-2", "tenant-3"]
  }'
```

---

## 🔧 POS Integration

### 1. Check Sync Status in POS UI

Add this to your POS admin panel:

```javascript
// Check menu sync status
async function checkMenuSyncStatus() {
  const tenantId = 'coorg-food-company-6163'; // Your tenant ID

  const response = await fetch(
    `https://filesearch-sync.suyesh.workers.dev/status/${tenantId}`
  );

  const { status } = await response.json();

  if (!status.inSync) {
    // Show warning banner
    showWarning(
      `Menu not synced: ${status.errors.join(', ')}`,
      'Sync Now'
    );
  } else {
    // Show success indicator
    showSuccess(
      `Menu synced ${new Date(status.lastSyncTime).toLocaleString()}`
    );
  }

  return status;
}

// Call on page load
checkMenuSyncStatus();

// Refresh every 30 seconds
setInterval(checkMenuSyncStatus, 30000);
```

---

### 2. Manual Sync Button

```javascript
async function syncMenuNow() {
  const tenantId = 'coorg-food-company-6163';

  showLoading('Syncing menu...');

  try {
    const response = await fetch(
      `https://filesearch-sync.suyesh.workers.dev/sync/full/${tenantId}`,
      { method: 'POST' }
    );

    const result = await response.json();

    if (result.success) {
      showSuccess('Menu synced successfully!');
      // Refresh status
      await checkMenuSyncStatus();
    } else {
      showError(`Sync failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    showError(`Sync failed: ${error.message}`);
  }
}
```

---

### 3. Auto-Sync After Menu Changes

Call webhook after any menu modification:

```javascript
async function triggerMenuSync() {
  const tenantId = 'coorg-food-company-6163';

  // Fire and forget - don't block UI
  fetch('https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      trigger: 'pos_menu_update',
      itemsChanged: 1
    })
  }).catch(err => console.error('Webhook failed:', err));
}

// Call after menu item save
async function saveMenuItem(item) {
  // Save to D1
  await saveToD1(item);

  // Trigger sync in background
  triggerMenuSync();

  // Don't wait for sync to complete
  showSuccess('Menu item saved!');
}
```

---

## 🎨 UI Status Indicator

Display sync status in your POS:

```html
<div id="sync-status" class="sync-status">
  <span class="status-icon">⚠️</span>
  <span class="status-text">Checking sync status...</span>
  <button class="sync-button" onclick="syncMenuNow()">Sync Now</button>
</div>

<style>
.sync-status {
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-status.synced {
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.sync-status.out-of-sync {
  background: #fff3cd;
  border: 1px solid #ffeeba;
}

.sync-status.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

.sync-button {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.sync-button:hover {
  background: #0056b3;
}
</style>

<script>
async function updateSyncUI() {
  const statusDiv = document.getElementById('sync-status');
  const status = await checkMenuSyncStatus();

  statusDiv.classList.remove('synced', 'out-of-sync', 'error');

  if (status.inSync) {
    statusDiv.classList.add('synced');
    statusDiv.querySelector('.status-icon').textContent = '✅';
    statusDiv.querySelector('.status-text').textContent =
      `Menu synced • ${new Date(status.lastSyncTime).toLocaleString()}`;
  } else {
    statusDiv.classList.add('out-of-sync');
    statusDiv.querySelector('.status-icon').textContent = '⚠️';
    statusDiv.querySelector('.status-text').textContent =
      `Menu out of sync • ${status.errors[0]}`;
  }
}

// Update on load and every 30 seconds
updateSyncUI();
setInterval(updateSyncUI, 30000);
</script>
```

---

## ✅ CORS Configuration

CORS is properly configured for POS access:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id
```

**Tested with:**
- ✅ Preflight OPTIONS requests
- ✅ Cross-origin POST requests
- ✅ Custom headers (X-Tenant-Id)

**Works from:**
- Desktop POS apps
- Web POS (any domain)
- Mobile POS apps
- localhost development

---

## 📊 Monitoring

### View Logs

```bash
wrangler tail --name filesearch-sync
```

Filter for specific tenant:

```bash
wrangler tail --name filesearch-sync --search "coorg-food-company-6163"
```

### Cloudflare Dashboard

View metrics at:
https://dash.cloudflare.com > Workers & Pages > filesearch-sync

**Metrics:**
- Request volume
- Success rate
- Latency (p50, p99)
- Error rates
- CPU time

---

## 🔄 Redeploy

To redeploy after code changes:

```bash
cd platform/workers/filesearch-sync
npm install
npx wrangler deploy
```

Or use the deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🐛 Troubleshooting

### Issue: "Tenant worker not found"

**Symptoms:**
```json
{
  "success": false,
  "error": "Failed to fetch menu from tenant worker: 404"
}
```

**Cause:** Tenant worker not deployed in `handsfree-tenants` dispatch namespace

**Fix:**
1. Deploy tenant worker first
2. Verify dispatch namespace binding in wrangler.jsonc
3. Check tenant ID is correct

---

### Issue: "File Search upload failed"

**Symptoms:**
```json
{
  "success": false,
  "error": "File Search upload failed: 500"
}
```

**Cause:** Backend API unreachable or File Search service down

**Fix:**
1. Check backend URL: https://stonepot-restaurant-334610188311.us-central1.run.app
2. Verify backend is running: `curl https://stonepot-restaurant-334610188311.us-central1.run.app/health`
3. Check Google Cloud quotas

---

### Issue: "Item count mismatch"

**Symptoms:**
```json
{
  "inSync": false,
  "errors": ["D1 has 45 items, File Search has 42 items"]
}
```

**Fix:**
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/full/coorg-food-company-6163
```

Wait 30 seconds, then check status again.

---

## 📚 Related Documentation

- [FILESEARCH_SYNC_ISSUE.md](../../../FILESEARCH_SYNC_ISSUE.md) - Sync workflow details
- [FILE_SEARCH_WORKFLOW.md](../../../FILE_SEARCH_WORKFLOW.md) - Complete architecture
- [Orders Worker](../orders/README.md) - POS operations worker

---

## 🔗 Quick Links

- **Worker URL:** https://filesearch-sync.suyesh.workers.dev
- **Health Check:** https://filesearch-sync.suyesh.workers.dev/health
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Backend API:** https://stonepot-restaurant-334610188311.us-central1.run.app

---

## 📞 Support

For issues or questions:
- Email: suyesh@gmail.com
- GitHub: https://github.com/suyeshs/handsfree-restaurant

---

**Last Updated:** 2026-01-28
**Worker Version:** 0576a27e-a3d0-4264-a365-dea9e4c1bdae
