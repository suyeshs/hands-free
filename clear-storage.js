// Complete Storage Cleanup Script
// Copy and paste this entire file into your browser console, then press Enter

console.log('🧹 Starting complete storage cleanup...');
console.log('═══════════════════════════════════════');

// 1. Clear localStorage
console.log('\n📦 Clearing localStorage...');
const lsKeys = Object.keys(localStorage);
console.log(`   Found ${lsKeys.length} items`);
lsKeys.forEach(key => {
  console.log(`   ❌ Removing: ${key}`);
  localStorage.removeItem(key);
});
localStorage.clear();
console.log('   ✅ localStorage cleared');

// 2. Clear sessionStorage
console.log('\n📦 Clearing sessionStorage...');
const ssKeys = Object.keys(sessionStorage);
console.log(`   Found ${ssKeys.length} items`);
sessionStorage.clear();
console.log('   ✅ sessionStorage cleared');

// 3. Clear cookies
console.log('\n🍪 Clearing cookies...');
const cookies = document.cookie.split(";");
console.log(`   Found ${cookies.length} cookies`);
cookies.forEach(c => {
  const name = c.split('=')[0].trim();
  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  console.log(`   ❌ Removed cookie: ${name}`);
});
console.log('   ✅ Cookies cleared');

// 4. Clear IndexedDB databases
console.log('\n💾 Clearing IndexedDB...');
if (window.indexedDB && indexedDB.databases) {
  indexedDB.databases().then(dbs => {
    console.log(`   Found ${dbs.length} databases`);
    dbs.forEach(db => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
        console.log(`   ❌ Deleted database: ${db.name}`);
      }
    });
    console.log('   ✅ IndexedDB cleared');
  }).catch(err => {
    console.log('   ⚠️  IndexedDB cleanup error:', err);
  });
} else {
  console.log('   ℹ️  IndexedDB not available or no databases');
}

// 5. Clear Cache Storage
console.log('\n💽 Clearing Cache Storage...');
if ('caches' in window) {
  caches.keys().then(names => {
    console.log(`   Found ${names.length} caches`);
    names.forEach(name => {
      caches.delete(name);
      console.log(`   ❌ Deleted cache: ${name}`);
    });
    console.log('   ✅ Cache Storage cleared');
  }).catch(err => {
    console.log('   ⚠️  Cache Storage cleanup error:', err);
  });
} else {
  console.log('   ℹ️  Cache Storage not available');
}

// 6. Clear Service Workers
console.log('\n⚙️  Checking Service Workers...');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log(`   Found ${registrations.length} service workers`);
    registrations.forEach(registration => {
      registration.unregister();
      console.log(`   ❌ Unregistered service worker: ${registration.scope}`);
    });
    console.log('   ✅ Service Workers cleared');
  }).catch(err => {
    console.log('   ⚠️  Service Worker cleanup error:', err);
  });
} else {
  console.log('   ℹ️  Service Workers not available');
}

// 7. Clear Device Registration (Tauri)
console.log('\n📱 Clearing Device Registration...');
if (window.__TAURI__) {
  (async () => {
    try {
      // Use Tauri's invoke API to clear device registration
      await window.__TAURI__.core.invoke('clear_device_registration');
      console.log('   ❌ Cleared device registration');
      console.log('   ✅ Device registration cleared successfully');

      // Now show summary and reload
      showSummaryAndReload();
    } catch (err) {
      console.log('   ⚠️  Device registration cleanup error:', err);
      console.log('   ℹ️  Continuing with browser storage cleanup only');
      showSummaryAndReload();
    }
  })();
} else {
  console.log('   ℹ️  Tauri not available (browser mode)');
  showSummaryAndReload();
}

function showSummaryAndReload() {
  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('✅✅✅ CLEANUP COMPLETE ✅✅✅');
  console.log('═══════════════════════════════════════');
  console.log('\n🔄 Page will reload in 2 seconds...');
  console.log('   Press Ctrl+C or Cmd+C to cancel reload');

  setTimeout(() => {
    console.log('🔄 Reloading page now...');
    location.reload();
  }, 2000);
}
