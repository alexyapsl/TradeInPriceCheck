#!/usr/bin/env node
/**
 * Isolated unit test for /price-cal endpoint
 * Uses the whitelisted IMEI and best-condition assumption
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CREDENTIALS_PATH = path.join(__dirname, 'secrets', 'tradein-credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

const { appId, appSecret, whitelistedImei, baseUrl } = credentials;

if (!appId || !appSecret || !whitelistedImei) {
  console.error('Missing credentials');
  process.exit(1);
}

console.log('Testing /price-cal with:');
console.log('  appId:', appId);
console.log('  IMEI:', whitelistedImei);

// HMAC-SHA256
function hmacSHA256(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex')
    .toLowerCase();
}

function buildSignString(params) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'signType')
    .sort();

  const parts = [];
  for (const key of sortedKeys) {
    const val = params[key];
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${key}=${typeof val === 'object' ? JSON.stringify(val) : val}`);
    }
  }
  return parts.join('&');
}

function generateRequestBody(bizContentObj) {
  const timestamp = Date.now().toString();
  const bizContent = JSON.stringify(bizContentObj);

  const params = {
    appId,
    bizContent,
    signType: 'HS256',
    timestamp
  };

  const signString = buildSignString(params);
  const sign = hmacSHA256(signString, appSecret);

  return {
    appId,
    bizContent,
    sign,
    signType: 'HS256',
    timestamp
  };
}

async function testPriceCal() {
  // Example payload (you will need real modelId + detailIds from option endpoint)
  const testPayload = {
    modelId: 5,                          // placeholder - replace with real modelId
    detailIds: [1, 2],                   // placeholder - storage + condition
    recyclePhoneImei: whitelistedImei,
    newPhoneModelCode: "18624007296"     // placeholder
  };

  console.log('\nRequest payload:', JSON.stringify(testPayload, null, 2));

  const body = generateRequestBody(testPayload);
  const url = `${baseUrl}/sapi/gateway/shanhs-global-recycle-api/samsung/price-cal`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    console.log('\nResponse:', JSON.stringify(json, null, 2));

    if (json.code === 0) {
      console.log('\n✅ SUCCESS - price-cal works');
      console.log('Trade-in price:', json.data?.price);
    } else {
      console.log('\n❌ API returned error code:', json.code);
    }
  } catch (err) {
    console.error('\n❌ Network / fetch error:', err.message);
  }
}

testPriceCal();