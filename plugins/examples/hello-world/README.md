# Hello World Plugin

A simple example plugin demonstrating the HandsFree POS WASM plugin system.

## Overview

This hybrid plugin runs on both:
- **Client-side** (Browser WASM): Greeting functions, offline calculations
- **Worker-side** (Cloudflare Workers WASM): API endpoints, server-side logic

## Features

### Client Plugin (`client/`)
- ✅ Initialize with plugin context
- ✅ Generate personalized greetings
- ✅ Time-aware greetings (morning/afternoon/evening)
- ✅ JSON data processing
- ✅ Pure calculations (works offline)

### Worker Plugin (`worker/`)
- ✅ HTTP API endpoints
- ✅ Server-side greetings with timestamps
- ✅ Plugin info endpoint
- ✅ Calculation functions

## Prerequisites

1. **Rust** (https://rustup.rs/)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **wasm32-unknown-unknown target**
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **wasm-bindgen-cli** (for client plugin)
   ```bash
   cargo install wasm-bindgen-cli
   ```

## Building

```bash
# Build both client and worker plugins
chmod +x build.sh
./build.sh
```

This will:
1. Compile client Rust code to WASM
2. Compile worker Rust code to WASM
3. Generate checksums
4. Create `dist/` with all plugin files

## Output

```
dist/
├── hello-world-client.wasm    # Client WASM plugin (~50KB optimized)
├── hello-world-worker.wasm    # Worker WASM plugin (~20KB optimized)
└── manifest.json              # Plugin metadata with checksum
```

## Installation

### Option 1: Manual Install (Development)

1. **Copy to R2 bucket**:
   ```bash
   # Upload to global registry
   aws s3 cp dist/ s3://handsfree-plugins/global/plugins/hello-world/1.0.0/ --recursive
   ```

2. **Update KV registry**:
   ```bash
   # Add manifest to PLUGIN_REGISTRY_GLOBAL
   wrangler kv:key put \
     --namespace-id=<PLUGIN_REGISTRY_GLOBAL_ID> \
     "plugin:hello-world" \
     --path=dist/manifest.json
   ```

3. **Install in POS app**:
   ```typescript
   import { usePluginStore } from '@/stores/pluginStore';

   const pluginStore = usePluginStore();
   await pluginStore.install('hello-world');
   ```

### Option 2: Using Plugin Manager UI (When Ready)

1. Open POS app
2. Navigate to Settings → Plugins
3. Search for "Hello World"
4. Click "Install"

## Usage

### In React Components

```typescript
import { useWasm } from '@/hooks/useWasm';

function HelloWorldExample() {
  const { instance, loading, error, invoke } = useWasm('hello-world');

  const greetUser = async () => {
    if (!instance) return;

    // Call the greet function
    const result = await invoke<string>('greet', 'Restaurant Owner');
    const data = JSON.parse(result);

    console.log(data.message); // "Hello, Restaurant Owner! Welcome to HandsFree POS!"
  };

  const greetWithTime = async () => {
    const result = await invoke<string>('greet_with_time', 'Chef');
    const data = JSON.parse(result);

    console.log(data.message); // "Good afternoon, Chef! Great to see you."
  };

  if (loading) return <div>Loading plugin...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={greetUser}>Greet User</button>
      <button onClick={greetWithTime}>Greet with Time</button>
    </div>
  );
}
```

### Calling Worker API

```typescript
// From POS app
const response = await fetch(
  'https://handsfree-tenant-router.workers.dev/api/plugin/hello-world/tenant-123/greet'
);

const data = await response.json();
console.log(data);
// {
//   "message": "Hello from the worker! Tenant: tenant-123",
//   "serverTime": "1706486400000",
//   "tenantId": "tenant-123"
// }
```

## API Reference

### Client Functions

#### `init(context_json: string, host_json: string)`
Initialize the plugin. Called automatically when loaded.

#### `greet(name: string) -> string`
Generate a simple greeting.

**Returns:**
```json
{
  "message": "Hello, {name}! Welcome to HandsFree POS!",
  "timestamp": 1706486400000,
  "pluginVersion": "1.0.0"
}
```

#### `greet_with_time(name: string) -> string`
Generate a time-aware greeting (morning/afternoon/evening/night).

#### `get_info() -> string`
Get plugin information.

#### `calculate_sum(a: number, b: number) -> number`
Simple calculation example.

#### `process_data(input_json: string) -> string`
Process array of numbers, calculate sum, count, and average.

**Input:**
```json
{
  "numbers": [1, 2, 3, 4, 5]
}
```

**Output:**
```json
{
  "sum": 15,
  "count": 5,
  "average": 3
}
```

### Worker Endpoints

#### `GET /api/plugin/hello-world/{tenantId}/greet`
Get a server-side greeting.

**Response:**
```json
{
  "message": "Hello from the worker! Tenant: {tenantId}",
  "serverTime": "1706486400000",
  "tenantId": "{tenantId}"
}
```

#### `GET /api/plugin/hello-world/{tenantId}/info`
Get plugin information from worker.

## Development

### Client Plugin

```bash
cd client
cargo build --target wasm32-unknown-unknown --release

# Run wasm-bindgen
wasm-bindgen \
  --target web \
  --out-dir ../dist \
  target/wasm32-unknown-unknown/release/hello_world_client.wasm
```

### Worker Plugin

```bash
cd worker
cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/hello_world_worker.wasm ../dist/
```

### Testing Locally

1. **Build the plugin**
   ```bash
   ./build.sh
   ```

2. **Start the POS app**
   ```bash
   bun tauri:dev
   ```

3. **Load plugin in dev mode**
   ```typescript
   // In browser console or test component
   const manager = getPluginManager('test-tenant');
   await manager.initialize();

   // Load WASM from local file
   const wasmBytes = await fetch('/dist/hello-world-client.wasm').then(r => r.arrayBuffer());
   // ... manual instantiation for testing
   ```

## File Structure

```
hello-world/
├── client/                     # Client-side Rust code
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
├── worker/                     # Worker-side Rust code
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
├── dist/                       # Build output (generated)
│   ├── hello-world-client.wasm
│   ├── hello-world-worker.wasm
│   └── manifest.json
├── manifest.json               # Plugin metadata
├── build.sh                    # Build script
└── README.md                   # This file
```

## Permissions

This plugin requires:
- `storage.hello-world` - For storing plugin-specific data
- `network.fetch.api.handsfree.com` - For calling HandsFree APIs

## Size

- **Client WASM**: ~50KB (optimized)
- **Worker WASM**: ~20KB (optimized)
- **Total**: ~70KB

## License

MIT

## Support

- GitHub Issues: https://github.com/handsfree/restaurant-pos-ai/issues
- Discord: https://discord.gg/handsfree
- Docs: https://docs.handsfree.com/plugins

## Next Steps

1. Study this example to understand plugin structure
2. Create your own plugin based on this template
3. Read the [Plugin Development Guide](../../../docs/plugin-development.md)
4. Join the plugin developer community!
