# Tauri HTTP Plugin StreamChannel Bug Fix

## Problem

The Tauri HTTP plugin v2.5.4 has a critical bug where calling response body methods (`.json()`, `.text()`, `.arrayBuffer()`, `.blob()`) throws this error:

```
TypeError: invalid args `streamChannel` for command `fetch_read_body`:
command fetch_read_body missing required key streamChannel
```

This was blocking all R2 file uploads and other HTTP operations in the Tauri desktop app.

## Root Cause

The Tauri HTTP plugin's `Response` object implementation has a bug in how it handles the internal `streamChannel` parameter when reading response bodies. This affects all response body reading methods.

## Solution

We implemented a **Rust-based HTTP command** that completely bypasses the buggy Tauri HTTP plugin Response object. The solution works as follows:

### 1. Rust HTTP Command (`http_fetch`)

Created a new Rust command that:
- Uses `reqwest` to make HTTP requests directly
- Reads the full response body into a `Vec<u8>`
- Returns the raw bytes along with status and headers to TypeScript
- Location: `src-tauri/src/commands/http_fetch.rs`

### 2. TypeScript Wrapper (`tauriFetch`)

Created a fetch-compatible wrapper that:
- Calls the Rust `http_fetch` command
- Wraps the response in a custom `TauriResponse` class that implements the `Response` interface
- Works as a drop-in replacement for `fetch()`
- Location: `src/lib/tauriFetch.ts`

### 3. Updated R2 Uploader

Modified `src/lib/r2Uploader.ts` to:
- Use `tauriFetch` instead of Tauri HTTP plugin fetch in desktop mode
- Keep using browser `fetch` in web mode
- This fixes all R2 uploads in the desktop app

## Implementation Details

### Files Created

1. **`src-tauri/src/commands/http_fetch.rs`** - Rust HTTP command
   ```rust
   #[command]
   pub async fn http_fetch(
       url: String,
       method: Option<String>,
       headers: Option<HashMap<String, String>>,
       body: Option<Vec<u8>>,
   ) -> Result<HttpResponse, String>
   ```

2. **`src/lib/tauriFetch.ts`** - TypeScript wrapper
   ```typescript
   export async function tauriFetch(
     input: RequestInfo | URL,
     init?: RequestInit
   ): Promise<Response>
   ```

### Files Modified

1. **`src-tauri/src/commands/mod.rs`** - Added `http_fetch` module
2. **`src-tauri/src/lib.rs`** - Registered `http_fetch` command in Tauri
3. **`src/lib/r2Uploader.ts`** - Updated to use `tauriFetch` in Tauri mode
4. **`src-tauri/capabilities/default.json`** - Added HTTP plugin permissions (though not strictly needed for our Rust solution)

## Usage

The fix is automatic. In Tauri desktop mode, all HTTP requests in `r2Uploader.ts` now use the Rust-based `tauriFetch` which bypasses the buggy Tauri HTTP plugin.

### Before (Broken)
```typescript
const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
const response = await tauriFetch(url, options);
const data = await response.json(); // ❌ StreamChannel error
```

### After (Fixed)
```typescript
import { tauriFetch } from './tauriFetch';
const response = await tauriFetch(url, options);
const data = await response.json(); // ✅ Works perfectly
```

## Why This Works

1. **Rust reqwest**: We use Rust's `reqwest` library which is mature and reliable
2. **Direct body read**: We read the response body completely in Rust using `.bytes().await`
3. **Simple IPC**: We pass the raw bytes over the Tauri IPC bridge as `Vec<u8>`
4. **Custom Response**: Our `TauriResponse` class properly implements all Response methods without relying on Tauri's buggy implementation

## Advantages

✅ **Reliable**: Uses battle-tested `reqwest` library
✅ **Compatible**: Drop-in replacement for standard `fetch()`
✅ **Future-proof**: Not dependent on Tauri plugin bug fixes
✅ **CORS bypass**: Still bypasses CORS restrictions like Tauri HTTP plugin
✅ **Type-safe**: Full TypeScript support with proper Response interface

## Testing

To test the fix:

1. Build the app:
   ```bash
   bun run build
   cargo tauri build
   ```

2. In the desktop app, try uploading a file through DiagnosticsPage or ExcelUploader

3. Verify no streamChannel errors in console

4. Confirm upload succeeds

## Future Improvements

If Tauri fixes the streamChannel bug in a future version, we can:
- Keep `tauriFetch` as a fallback for older versions
- Or remove it entirely and go back to using Tauri HTTP plugin
- The wrapper design makes this easy to switch

## Additional Notes

- The Rust command supports all standard HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- Request and response bodies are handled as raw bytes for maximum compatibility
- Headers are properly converted between TypeScript and Rust
- The custom Response class implements all required methods: `json()`, `text()`, `blob()`, `arrayBuffer()`, `bytes()`

## Related Files

- Issue: R2 upload errors with streamChannel bug
- PR: (link to PR if creating one)
- Tauri HTTP Plugin: v2.5.4 (has the bug)
- Rust reqwest: v0.12.24 (working correctly)
