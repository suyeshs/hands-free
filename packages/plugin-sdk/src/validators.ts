/**
 * Plugin manifest and permission validators
 */

import type { PluginManifest, PluginPermission } from './types';

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate plugin manifest
 * Throws ValidationError if invalid
 */
export function validateManifest(manifest: unknown): asserts manifest is PluginManifest {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new ValidationError('Manifest must be an object');
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.id !== 'string' || !m.id) {
    throw new ValidationError('Missing or invalid id', 'id');
  }

  if (typeof m.name !== 'string' || !m.name) {
    throw new ValidationError('Missing or invalid name', 'name');
  }

  if (typeof m.version !== 'string' || !m.version) {
    throw new ValidationError('Missing or invalid version', 'version');
  }

  // Validate version format (semver)
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(m.version)) {
    throw new ValidationError('Invalid version format (expected semver)', 'version');
  }

  if (typeof m.description !== 'string') {
    throw new ValidationError('Missing or invalid description', 'description');
  }

  if (typeof m.author !== 'string') {
    throw new ValidationError('Missing or invalid author', 'author');
  }

  // Type
  if (!['client', 'worker', 'hybrid'].includes(m.type as string)) {
    throw new ValidationError('Invalid type (must be client, worker, or hybrid)', 'type');
  }

  // Visibility
  if (m.visibility && !['public', 'private', 'tenant-specific'].includes(m.visibility as string)) {
    throw new ValidationError(
      'Invalid visibility (must be public, private, or tenant-specific)',
      'visibility'
    );
  }

  // Target
  if (typeof m.target !== 'object' || m.target === null) {
    throw new ValidationError('Missing or invalid target', 'target');
  }

  const target = m.target as Record<string, unknown>;
  if (typeof target.client !== 'boolean' || typeof target.worker !== 'boolean') {
    throw new ValidationError('Target must have client and worker boolean fields', 'target');
  }

  if (!target.client && !target.worker) {
    throw new ValidationError('Plugin must target at least client or worker', 'target');
  }

  // Requires app version
  if (typeof m.requires_app_version !== 'string') {
    throw new ValidationError('Missing or invalid requires_app_version', 'requires_app_version');
  }

  // Permissions
  if (!Array.isArray(m.requires_permissions)) {
    throw new ValidationError('requires_permissions must be an array', 'requires_permissions');
  }

  // Frontend (if client plugin)
  if (target.client) {
    if (typeof m.frontend !== 'object' || m.frontend === null) {
      throw new ValidationError('Client plugin must have frontend configuration', 'frontend');
    }

    const frontend = m.frontend as Record<string, unknown>;
    if (typeof frontend.wasm !== 'string') {
      throw new ValidationError('Missing frontend.wasm path', 'frontend.wasm');
    }

    if (typeof frontend.entry_point !== 'string') {
      throw new ValidationError('Missing frontend.entry_point', 'frontend.entry_point');
    }
  }

  // Backend (if worker plugin)
  if (target.worker) {
    if (typeof m.backend !== 'object' || m.backend === null) {
      throw new ValidationError('Worker plugin must have backend configuration', 'backend');
    }

    const backend = m.backend as Record<string, unknown>;
    if (typeof backend.wasm !== 'string') {
      throw new ValidationError('Missing backend.wasm path', 'backend.wasm');
    }

    if (typeof backend.entry_point !== 'string') {
      throw new ValidationError('Missing backend.entry_point', 'backend.entry_point');
    }
  }

  // Checksum
  if (typeof m.checksum !== 'string' || !m.checksum.startsWith('sha256:')) {
    throw new ValidationError('Invalid checksum (must start with sha256:)', 'checksum');
  }

  // Timestamps
  if (typeof m.created_at !== 'string') {
    throw new ValidationError('Missing or invalid created_at', 'created_at');
  }

  if (typeof m.updated_at !== 'string') {
    throw new ValidationError('Missing or invalid updated_at', 'updated_at');
  }
}

/**
 * Validate a permission string
 */
export function validatePermission(permission: string): asserts permission is PluginPermission {
  const validPrefixes = [
    'database.read.',
    'database.write.',
    'ui.mount.',
    'events.subscribe.',
    'events.emit.',
    'network.fetch.',
    'storage.',
    'files.read.',
    'files.write.',
  ];

  const isValid = validPrefixes.some(prefix => permission.startsWith(prefix));

  if (!isValid) {
    throw new ValidationError(
      `Invalid permission: ${permission}. Must start with one of: ${validPrefixes.join(', ')}`,
      'permission'
    );
  }
}

/**
 * Validate all permissions in manifest
 */
export function validatePermissions(manifest: PluginManifest): void {
  for (const permission of manifest.requires_permissions) {
    try {
      validatePermission(permission);
    } catch (error) {
      throw new ValidationError(
        `Invalid permission in manifest: ${permission}`,
        'requires_permissions'
      );
    }
  }
}
