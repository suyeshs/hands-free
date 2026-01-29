/**
 * @handsfree/plugin-sdk
 *
 * Official SDK for developing HandsFree POS plugins
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@handsfree/plugin-sdk';
 *
 * export default definePlugin({
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   async init(context, host) {
 *     console.log('Plugin initialized!');
 *   }
 * });
 * ```
 */

export * from './types';
export * from './helpers';
export * from './validators';
export { definePlugin, defineWorkerPlugin } from './definePlugin';
