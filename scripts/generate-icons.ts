#!/usr/bin/env bun
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const TAURI_ICONS_DIR = join(PROJECT_ROOT, 'src-tauri', 'icons');

// Icon configurations for different platforms
const ICON_SIZES = {
  // iOS
  ios: [
    { name: 'ios-1024.png', size: 1024 },
  ],
  // Android
  android: [
    { name: 'android-48.png', size: 48 },
    { name: 'android-72.png', size: 72 },
    { name: 'android-96.png', size: 96 },
    { name: 'android-144.png', size: 144 },
    { name: 'android-192.png', size: 192 },
    { name: 'android-512.png', size: 512 },
  ],
  // Web/PWA
  pwa: [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ],
  // Tauri Desktop
  tauri: [
    { name: 'icon.png', size: 512 },
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    // Windows Store logos
    { name: 'Square30x30Logo.png', size: 30 },
    { name: 'Square44x44Logo.png', size: 44 },
    { name: 'Square71x71Logo.png', size: 71 },
    { name: 'Square89x89Logo.png', size: 89 },
    { name: 'Square107x107Logo.png', size: 107 },
    { name: 'Square142x142Logo.png', size: 142 },
    { name: 'Square150x150Logo.png', size: 150 },
    { name: 'Square284x284Logo.png', size: 284 },
    { name: 'Square310x310Logo.png', size: 310 },
    { name: 'StoreLogo.png', size: 50 },
  ],
};

async function generateIcon(
  svgPath: string,
  outputPath: string,
  size: number,
  background?: { r: number; g: number; b: number; alpha: number }
) {
  try {
    let sharpInstance = sharp(svgPath).resize(size, size, {
      fit: 'contain',
      background: background || { r: 0, g: 0, b: 0, alpha: 0 },
    });

    await sharpInstance.png().toFile(outputPath);
    console.log(`✓ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error);
  }
}

async function generateFavicon(svgPath: string, outputPath: string) {
  try {
    await sharp(svgPath)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(outputPath);
    console.log(`✓ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error);
  }
}

async function main() {
  const lightSvg = join(PUBLIC_DIR, 'icon-light.svg');
  const darkSvg = join(PUBLIC_DIR, 'icon-dark.svg');

  // Ensure output directories exist
  const androidDir = join(PUBLIC_DIR, 'icons', 'android');
  const iosDir = join(PUBLIC_DIR, 'icons', 'ios');
  const pwaDir = join(PUBLIC_DIR, 'icons', 'pwa');

  await mkdir(join(PUBLIC_DIR, 'icons'), { recursive: true });
  await mkdir(androidDir, { recursive: true });
  await mkdir(iosDir, { recursive: true });
  await mkdir(pwaDir, { recursive: true });

  console.log('\n🎨 Generating LIGHT MODE icons...\n');

  // iOS icons (light mode)
  for (const { name, size } of ICON_SIZES.ios) {
    await generateIcon(lightSvg, join(iosDir, name), size);
  }

  // Android icons (light mode)
  for (const { name, size } of ICON_SIZES.android) {
    await generateIcon(lightSvg, join(androidDir, name), size);
  }

  // PWA icons (light mode)
  for (const { name, size } of ICON_SIZES.pwa) {
    await generateIcon(lightSvg, join(pwaDir, name), size);
  }

  // Tauri icons (light mode)
  for (const { name, size } of ICON_SIZES.tauri) {
    await generateIcon(lightSvg, join(TAURI_ICONS_DIR, name), size);
  }

  // Favicon (light mode)
  await generateFavicon(lightSvg, join(PUBLIC_DIR, 'favicon.png'));

  console.log('\n🌙 Generating DARK MODE icons...\n');

  // Dark mode versions (with -dark suffix)
  const darkAndroidDir = join(PUBLIC_DIR, 'icons', 'android-dark');
  const darkIosDir = join(PUBLIC_DIR, 'icons', 'ios-dark');
  const darkPwaDir = join(PUBLIC_DIR, 'icons', 'pwa-dark');

  await mkdir(darkAndroidDir, { recursive: true });
  await mkdir(darkIosDir, { recursive: true });
  await mkdir(darkPwaDir, { recursive: true });

  // iOS dark mode
  for (const { name, size } of ICON_SIZES.ios) {
    await generateIcon(darkSvg, join(darkIosDir, name), size);
  }

  // Android dark mode
  for (const { name, size } of ICON_SIZES.android) {
    await generateIcon(darkSvg, join(darkAndroidDir, name), size);
  }

  // PWA dark mode
  for (const { name, size } of ICON_SIZES.pwa) {
    const darkName = name.replace('.png', '-dark.png');
    await generateIcon(darkSvg, join(pwaDir, darkName), size);
  }

  console.log('\n✨ Icon generation complete!\n');
  console.log('Generated icons in:');
  console.log(`  - ${join(PUBLIC_DIR, 'icons')}`);
  console.log(`  - ${TAURI_ICONS_DIR}`);
}

main().catch(console.error);
