#!/usr/bin/env bun
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const TAURI_ICONS_DIR = join(PROJECT_ROOT, 'src-tauri', 'icons');
const ORIGINAL_LOGO = join(PUBLIC_DIR, 'gaunix-pink-logo.png');

// Icon configurations for different platforms
const ICON_SIZES = {
  ios: [{ name: 'ios-1024.png', size: 1024 }],
  android: [
    { name: 'android-48.png', size: 48 },
    { name: 'android-72.png', size: 72 },
    { name: 'android-96.png', size: 96 },
    { name: 'android-144.png', size: 144 },
    { name: 'android-192.png', size: 192 },
    { name: 'android-512.png', size: 512 },
  ],
  pwa: [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ],
  tauri: [
    { name: 'icon.png', size: 512 },
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
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

async function extractSymbol() {
  console.log('\n🎨 Extracting symbol from original logo...\n');

  // Read the original logo
  const logo = sharp(ORIGINAL_LOGO);
  const metadata = await logo.metadata();

  console.log(`Original logo size: ${metadata.width}x${metadata.height}`);

  // Calculate crop area to remove text at bottom
  // The symbol takes up roughly the top 65-70% of the image
  const symbolHeight = Math.floor(metadata.height! * 0.65);

  // Extract just the symbol (top portion, removing "GUANIX" text)
  const symbolBuffer = await logo
    .extract({
      left: 0,
      top: 0,
      width: metadata.width!,
      height: symbolHeight,
    })
    .toBuffer();

  // Trim transparent edges to get tight bounds around the symbol
  const symbolTrimmed = await sharp(symbolBuffer)
    .trim()
    .toBuffer();

  console.log('✓ Symbol extracted and trimmed');

  return symbolTrimmed;
}

async function createDarkModeVersion(buffer: Buffer) {
  console.log('\n🌙 Creating dark mode version with adjusted brightness...\n');

  // For dark mode, increase brightness and adjust colors to be more visible on dark backgrounds
  const darkBuffer = await sharp(buffer)
    .modulate({
      brightness: 1.3, // Increase brightness by 30%
      saturation: 1.1, // Slight saturation boost
    })
    .toBuffer();

  console.log('✓ Dark mode version created');

  return darkBuffer;
}

async function generateIconsFromBuffer(
  buffer: Buffer,
  outputDir: string,
  filename: string,
  size: number
) {
  try {
    const outputPath = join(outputDir, filename);

    await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated: ${filename} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${filename}:`, error);
  }
}

async function main() {
  // Extract the symbol from original logo
  const lightSymbol = await extractSymbol();

  // Create dark mode version
  const darkSymbol = await createDarkModeVersion(lightSymbol);

  // Save base icons for reference
  await sharp(lightSymbol)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC_DIR, 'icon-light-1024.png'));

  await sharp(darkSymbol)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC_DIR, 'icon-dark-1024.png'));

  console.log('\n✓ Saved base icons (1024x1024) to public/\n');

  // Ensure output directories exist
  const androidDir = join(PUBLIC_DIR, 'icons', 'android');
  const iosDir = join(PUBLIC_DIR, 'icons', 'ios');
  const pwaDir = join(PUBLIC_DIR, 'icons', 'pwa');
  const darkAndroidDir = join(PUBLIC_DIR, 'icons', 'android-dark');
  const darkIosDir = join(PUBLIC_DIR, 'icons', 'ios-dark');

  await mkdir(join(PUBLIC_DIR, 'icons'), { recursive: true });
  await mkdir(androidDir, { recursive: true });
  await mkdir(iosDir, { recursive: true });
  await mkdir(pwaDir, { recursive: true });
  await mkdir(darkAndroidDir, { recursive: true });
  await mkdir(darkIosDir, { recursive: true });

  console.log('☀️  Generating LIGHT MODE icons...\n');

  // Generate iOS icons
  for (const { name, size } of ICON_SIZES.ios) {
    await generateIconsFromBuffer(lightSymbol, iosDir, name, size);
  }

  // Generate Android icons
  for (const { name, size } of ICON_SIZES.android) {
    await generateIconsFromBuffer(lightSymbol, androidDir, name, size);
  }

  // Generate PWA icons
  for (const { name, size } of ICON_SIZES.pwa) {
    await generateIconsFromBuffer(lightSymbol, pwaDir, name, size);
  }

  // Generate Tauri icons
  for (const { name, size } of ICON_SIZES.tauri) {
    await generateIconsFromBuffer(lightSymbol, TAURI_ICONS_DIR, name, size);
  }

  // Generate favicon
  await generateIconsFromBuffer(lightSymbol, PUBLIC_DIR, 'favicon.png', 32);

  console.log('\n🌙 Generating DARK MODE icons...\n');

  // Dark mode iOS
  for (const { name, size } of ICON_SIZES.ios) {
    await generateIconsFromBuffer(darkSymbol, darkIosDir, name, size);
  }

  // Dark mode Android
  for (const { name, size } of ICON_SIZES.android) {
    await generateIconsFromBuffer(darkSymbol, darkAndroidDir, name, size);
  }

  // Dark mode PWA
  for (const { name, size } of ICON_SIZES.pwa) {
    const darkName = name.replace('.png', '-dark.png');
    await generateIconsFromBuffer(darkSymbol, pwaDir, darkName, size);
  }

  console.log('\n✨ Icon generation complete!\n');
  console.log('Generated icons in:');
  console.log(`  - ${join(PUBLIC_DIR, 'icons')}`);
  console.log(`  - ${TAURI_ICONS_DIR}`);
  console.log('\nNext step: Run "npx png2icons src-tauri/icons/icon.png src-tauri/icons/icon -all -i" to generate .icns and .ico');
}

main().catch(console.error);
