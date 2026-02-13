#!/usr/bin/env node

/**
 * Automated domain setup for auth.handsfree.tech
 * This script handles DNS records and custom domain configuration
 */

const { execSync } = require('child_process');
const readline = require('readline');

const DOMAIN = 'handsfree.tech';
const SUBDOMAIN = 'auth';
const FULL_DOMAIN = `${SUBDOMAIN}.${DOMAIN}`;
const WORKER_NAME = 'stonepot-oauth';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function exec(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(`✅ ${description} - Done`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} - Failed`);
    console.error(error.message);
    throw error;
  }
}

async function createDNSRecord(zoneId, apiToken, type, name, content, proxied = false) {
  console.log(`\n🔄 Creating ${type} record: ${name}`);

  // Check if record exists
  const checkCmd = `curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${type}&name=${name}" \
    -H "Authorization: Bearer ${apiToken}" \
    -H "Content-Type: application/json"`;

  const checkResult = JSON.parse(execSync(checkCmd, { encoding: 'utf8' }));

  if (checkResult.result && checkResult.result.length > 0) {
    const recordId = checkResult.result[0].id;
    // Update existing
    const updateCmd = `curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}" \
      -H "Authorization: Bearer ${apiToken}" \
      -H "Content-Type: application/json" \
      --data '{"type":"${type}","name":"${name}","content":"${content}","proxied":${proxied}}'`;

    execSync(updateCmd);
    console.log(`✅ Updated ${type} record: ${name}`);
  } else {
    // Create new
    const createCmd = `curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records" \
      -H "Authorization: Bearer ${apiToken}" \
      -H "Content-Type: application/json" \
      --data '{"type":"${type}","name":"${name}","content":"${content}","proxied":${proxied}}'`;

    execSync(createCmd);
    console.log(`✅ Created ${type} record: ${name}`);
  }
}

async function main() {
  console.log('=========================================');
  console.log('  Stonepot Auth Domain Setup');
  console.log('=========================================\n');

  // Step 1: Deploy worker
  await exec('npx wrangler deploy', 'Deploying worker');

  // Step 2: Get Zone ID
  console.log('\n🔍 Getting Cloudflare Zone ID...');
  let zoneId;
  try {
    const zonesOutput = execSync('npx wrangler zones list', { encoding: 'utf8' });
    const match = zonesOutput.match(/([a-f0-9]{32})/);
    zoneId = match ? match[1] : null;
  } catch (error) {
    console.log('⚠️  Could not get zone automatically');
  }

  if (!zoneId) {
    console.log('\nPlease enter your Cloudflare Zone ID for', DOMAIN);
    console.log('(Find it at: https://dash.cloudflare.com)');
    zoneId = await question('Zone ID: ');
  }
  console.log(`✅ Zone ID: ${zoneId}`);

  // Step 3: Attach custom domain
  console.log('\n🔄 Attaching custom domain...');
  try {
    execSync(`npx wrangler deployments domains attach ${FULL_DOMAIN}`, { stdio: 'inherit' });
    console.log(`✅ Custom domain attached: ${FULL_DOMAIN}`);
  } catch (error) {
    console.log('⚠️  Custom domain may already be attached or needs manual setup');
  }

  // Step 4: Create DNS records
  console.log('\n📝 Setting up DNS records...');
  console.log('Please enter your Cloudflare API Token');
  console.log('(Create at: https://dash.cloudflare.com/profile/api-tokens)');
  console.log('Required permissions: Zone.DNS (Edit)\n');
  const apiToken = await question('API Token: ');

  try {
    // CNAME for auth subdomain
    await createDNSRecord(zoneId, apiToken, 'CNAME', FULL_DOMAIN, `${WORKER_NAME}.suyesh.workers.dev`, true);

    // Email authentication records
    await createDNSRecord(zoneId, apiToken, 'TXT', DOMAIN, 'v=spf1 include:relay.mailchannels.net ~all', false);
    await createDNSRecord(zoneId, apiToken, 'TXT', `_mailchannels.${DOMAIN}`, `v=mc1 cfid=${FULL_DOMAIN}`, false);
    await createDNSRecord(zoneId, apiToken, 'TXT', `_dmarc.${DOMAIN}`, `v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}; pct=100; adkim=s; aspf=s`, false);

    console.log('\n✅ All DNS records created/updated!');
  } catch (error) {
    console.error('\n❌ DNS record creation failed:', error.message);
  }

  // Step 5: Complete
  console.log('\n=========================================');
  console.log('  Setup Complete! 🎉');
  console.log('=========================================\n');
  console.log('Your auth service is now available at:');
  console.log(`🔗 https://${FULL_DOMAIN}\n`);
  console.log('Note: DNS propagation may take a few minutes.');
  console.log('Check status at: https://dnschecker.org\n');

  rl.close();
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  rl.close();
  process.exit(1);
});
