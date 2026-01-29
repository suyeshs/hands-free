#!/bin/bash
set -e

echo "🚀 Setting up all plugin WASM projects..."

# Define plugins (name, crate_name, version)
declare -a PLUGINS=(
  "inventory-management:inventory_client:2.5.0"
  "people-payroll:people_client:2.2.0"
  "analytics-reports:analytics_client:2.0.0"
  "customer-crm:crm_client:1.8.0"
  "multi-location-sync:multilocation_client:1.8.0"
  "online-ordering-qr:qr_client:2.1.0"
)

for plugin_info in "${PLUGINS[@]}"; do
  IFS=':' read -r plugin_name crate_name version <<< "$plugin_info"

  echo ""
  echo "📦 Setting up $plugin_name..."

  # Create directory structure
  mkdir -p "plugins/$plugin_name/client/src"

  # Create Cargo.toml
  cat > "plugins/$plugin_name/client/Cargo.toml" <<EOF
[package]
name = "$crate_name"
version = "$version"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = false

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde-wasm-bindgen = "0.6"
js-sys = "0.3"

[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Enable Link Time Optimization
codegen-units = 1   # Reduce parallel code generation
strip = true        # Strip symbols for smaller binary
EOF

  # Create basic lib.rs
  cat > "plugins/$plugin_name/client/src/lib.rs" <<EOF
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    (\$(\$t:tt)*) => (log(&format!(\$(\$t)*)))
}

#[wasm_bindgen]
pub fn init() -> String {
    console_log!("[$plugin_name WASM] Initialized v$version");
    "${plugin_name}-v${version}".to_string()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "$version".to_string()
}

// TODO: Add plugin-specific business logic functions here
EOF

  # Create build script
  cat > "plugins/$plugin_name/client/build.sh" <<EOF
#!/bin/bash
set -e

echo "🔨 Building $plugin_name client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/$plugin_name
cp target/wasm32-unknown-unknown/release/${crate_name}.wasm ../../../dist/plugins/$plugin_name/${plugin_name/-/-}-client.wasm

echo "✅ $plugin_name client WASM built successfully"
echo "📦 Output: dist/plugins/$plugin_name/${plugin_name/-/-}-client.wasm"
ls -lh ../../../dist/plugins/$plugin_name/${plugin_name/-/-}-client.wasm
EOF

  chmod +x "plugins/$plugin_name/client/build.sh"

  echo "✅ $plugin_name setup complete"
done

echo ""
echo "🎉 All plugins set up successfully!"
echo ""
echo "To build all plugins, run: ./plugins/build-all-new.sh"
