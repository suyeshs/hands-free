#!/usr/bin/env bun
/**
 * Increments the patch version in tauri.conf.json and Cargo.toml before each build.
 * Called automatically via beforeBuildCommand.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..");
const tauriConf = join(root, "src-tauri", "tauri.conf.json");
const cargoToml = join(root, "src-tauri", "Cargo.toml");

// Bump patch in tauri.conf.json
const conf = JSON.parse(readFileSync(tauriConf, "utf8"));
const parts = conf.version.split(".").map(Number) as [number, number, number];
const prev = conf.version;
conf.version = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
writeFileSync(tauriConf, JSON.stringify(conf, null, 2) + "\n");
console.log(`[bump-version] ${prev} → ${conf.version}`);

// Mirror the same version into Cargo.toml (first version = line in [package] block)
let cargo = readFileSync(cargoToml, "utf8");
cargo = cargo.replace(/^(version\s*=\s*)"[^"]*"/m, `$1"${conf.version}"`);
writeFileSync(cargoToml, cargo);
