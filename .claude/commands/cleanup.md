# Cleanup Build Artifacts

Clean up build artifacts across all projects to free disk space.

## Instructions

1. **Scan current project** for build artifacts:
   - `src-tauri/target` (Rust builds)
   - `node_modules` (Node dependencies)
   - `dist`, `build`, `out` (build outputs)
   - `.next`, `.nuxt` (framework builds)
   - `.wrangler` (Cloudflare artifacts)
   - `target` (Rust workspace targets)

2. **Scan other projects** in `/Users/stonepot-tech/projects/`:
   - Find all `node_modules` directories
   - Find all `src-tauri/target` directories
   - Find all framework build directories
   - Display sizes in human-readable format

3. **Report findings** with a summary showing:
   - Total space that can be freed
   - Breakdown by project and artifact type
   - Current disk usage

4. **Execute cleanup**:
   - Remove all found build artifacts
   - Clean Cargo cache with `cargo cache --autoclean-expensive`
   - Show final disk space after cleanup

5. **Provide restoration instructions**:
   - How to restore Node dependencies (`bun install` or `npm install`)
   - How to rebuild Rust projects (`cargo build`)

## Safety Notes
- Never delete source files or configuration
- Only remove reproducible build artifacts
- Show summary before deletion (unless user explicitly says to skip confirmation)
