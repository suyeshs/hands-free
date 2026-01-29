#!/usr/bin/env node
/**
 * Creates minimal valid WASM modules as placeholders
 * These export the required functions but with minimal implementation
 */

const fs = require('fs');
const path = require('path');

// Minimal WASM module that exports init() and get_version()
// This is a hand-crafted WASM binary that's valid but minimal
const createMinimalWASM = (moduleName, version) => {
  // WebAssembly binary format (magic number + version)
  const wasmHeader = Buffer.from([
    0x00, 0x61, 0x73, 0x6d, // Magic number '\0asm'
    0x01, 0x00, 0x00, 0x00, // Version 1
  ]);

  // Type section: Define function signatures
  const typeSection = Buffer.from([
    0x01, // Section ID: Type
    0x07, // Section length
    0x01, // Number of types
    0x60, // Function type
    0x00, // No parameters
    0x01, 0x7f, // One return value: i32
  ]);

  // Function section: Declare functions
  const functionSection = Buffer.from([
    0x03, // Section ID: Function
    0x03, // Section length
    0x02, // Number of functions
    0x00, // Function 0 uses type 0
    0x00, // Function 1 uses type 0
  ]);

  // Export section: Export the functions
  const exportSection = Buffer.from([
    0x07, // Section ID: Export
    0x13, // Section length
    0x02, // Number of exports
    // Export 1: "init"
    0x04, 0x69, 0x6e, 0x69, 0x74, // Name: "init"
    0x00, 0x00, // Export kind: function, index 0
    // Export 2: "get_version"
    0x0b, 0x67, 0x65, 0x74, 0x5f, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e,
    0x00, 0x01, // Export kind: function, index 1
  ]);

  // Code section: Function bodies
  const codeSection = Buffer.from([
    0x0a, // Section ID: Code
    0x0b, // Section length
    0x02, // Number of function bodies
    // Function 0 body (init): returns 1
    0x04, // Body size
    0x00, // No local variables
    0x41, 0x01, // i32.const 1
    0x0b, // end
    // Function 1 body (get_version): returns 1
    0x04, // Body size
    0x00, // No local variables
    0x41, 0x01, // i32.const 1
    0x0b, // end
  ]);

  return Buffer.concat([
    wasmHeader,
    typeSection,
    functionSection,
    exportSection,
    codeSection,
  ]);
};

// Create plugin WASM files
const plugins = [
  {
    name: 'bar-client',
    version: '2.1.0',
    path: '../dist/plugins/bar-management-v2/bar-client.wasm',
  },
  {
    name: 'aggregator-client',
    version: '2.3.0',
    path: '../dist/plugins/aggregator-integration-india/aggregator-client.wasm',
  },
];

console.log('📦 Creating placeholder WASM modules...\n');

plugins.forEach(plugin => {
  const wasmModule = createMinimalWASM(plugin.name, plugin.version);
  const outputPath = path.join(__dirname, plugin.path);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, wasmModule);
  console.log(`✅ Created ${plugin.name}.wasm (${wasmModule.length} bytes)`);
  console.log(`   Path: ${outputPath}`);
});

console.log('\n🎉 All placeholder WASM files created successfully!');
console.log('\n⚠️  Note: These are minimal placeholder modules.');
console.log('   For full functionality, compile the Rust code with:');
console.log('   ./plugins/build-all.sh\n');
