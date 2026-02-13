#!/usr/bin/env node
/**
 * Upload Khao Piyo logos to Cloudflare Images
 * Uses the existing Cloudflare API token from the codebase
 */

const fs = require('fs');
const path = require('path');

// Configuration from restaurant-client/app/api/cfupload/route.ts
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'PEjPQStb94cuLh-Wor0yG59NCLE5WS6Js5DrBsfi';

const ASSETS_DIR = path.join(__dirname, 'assets', 'logos');

const IMAGES = [
  {
    file: 'khao-piyo-logo-final.png',
    id: 'khao-piyo-logo',
    metadata: {
      alt: 'Khao Piyo Logo - Multi Cuisine Family Restaurant & Bar',
      tenant: 'khao-piyo-7766',
      type: 'logo'
    }
  },
  {
    file: 'khao-piyo-text-transparent.png',
    id: 'khao-piyo-text',
    metadata: {
      alt: 'Khao Piyo Restaurant Name',
      tenant: 'khao-piyo-7766',
      type: 'text-logo'
    }
  }
];

async function uploadImage(imageConfig) {
  const filePath = path.join(ASSETS_DIR, imageConfig.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log(`\n📤 Uploading ${imageConfig.file}...`);

  const FormData = (await import('undici')).FormData;
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('file', blob, imageConfig.file);
  formData.append('id', imageConfig.id);
  formData.append('metadata', JSON.stringify(imageConfig.metadata));

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error(`❌ Upload failed:`, result);
    throw new Error(result.errors?.[0]?.message || 'Upload failed');
  }

  const imageUrl = result.result.variants?.[0] || `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}/${result.result.id}/public`;

  console.log(`✅ Uploaded successfully!`);
  console.log(`   📷 Image ID: ${result.result.id}`);
  console.log(`   🔗 URL: ${imageUrl}`);

  return {
    id: result.result.id,
    url: imageUrl,
    fileName: imageConfig.file,
    configId: imageConfig.id
  };
}

async function main() {
  console.log('🚀 Uploading Khao Piyo logos to Cloudflare Images...');
  console.log(`   Account ID: ${CLOUDFLARE_ACCOUNT_ID}`);
  console.log(`   Assets directory: ${ASSETS_DIR}`);

  try {
    const results = [];

    for (const imageConfig of IMAGES) {
      const result = await uploadImage(imageConfig);
      results.push(result);
    }

    console.log('\n\n✨ All uploads complete!');
    console.log('\n📋 Summary:');
    console.log('─'.repeat(80));

    results.forEach(result => {
      console.log(`\n${result.fileName}:`);
      console.log(`  ID:  ${result.id}`);
      console.log(`  URL: ${result.url}`);
    });

    console.log('\n\n📝 Update khaopiyo-theme-config.json with these URLs:');
    console.log('─'.repeat(80));

    const logoResult = results.find(r => r.configId === 'khao-piyo-logo');
    const textResult = results.find(r => r.configId === 'khao-piyo-text');

    console.log(`
{
  "branding": {
    "logo": {
      "url": "${logoResult?.url}",
      "alt": "Khao Piyo - Multi Cuisine Family Restaurant & Bar",
      "width": 1348,
      "height": 1349
    },
    "nameImage": {
      "url": "${textResult?.url}",
      "alt": "Khao Piyo",
      "width": 1658,
      "height": 244
    }
  }
}
    `);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
