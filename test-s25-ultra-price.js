#!/usr/bin/env node
/**
 * Test /price-cal for Samsung Galaxy S25 Ultra 1TB
 * Using whitelisted IMEI + best condition assumption
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CREDENTIALS_PATH = path.join(__dirname, 'secrets', 'tradein-credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

const { appId, appSecret, whitelistedImei, baseUrl } = credentials;

console.log('=== Price-Cal Test: Samsung Galaxy S25 Ultra 1TB ===');
console.log('IMEI:', whitelistedImei);
console.log('Condition: Perfect (best)');

// === Signing helpers ===
function hmacSHA256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex').toLowerCase();
}

function buildSignString(params) {
  return Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'signType')
    .sort()
    .map(k => `${k}=${typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k]}`)
    .join('&');
}

function generateRequestBody(bizContentObj) {
  const timestamp = Date.now().toString();
  const bizContent = JSON.stringify(bizContentObj);
  const params = { appId, bizContent, signType: 'HS256', timestamp };
  const sign = hmacSHA256(buildSignString(params), appSecret);
  return { appId, bizContent, sign, signType: 'HS256', timestamp };
}

async function apiCall(endpoint, bizContentObj) {
  const body = generateRequestBody(bizContentObj);
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  if (json.code !== 0) {
    console.error('API Error:', json);
    return null;
  }
  return json.data;
}

async function runTest() {
  try {
    // 1. Find Samsung brandId for smartphones (category 1)
    console.log('\n[1] Fetching brands...');
    const brandData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/brand/list', { categoryId: 1 });
    const samsung = brandData?.find(b => b.languageId === 4)?.brandList?.find(b => b.brandName.toLowerCase() === 'samsung');
    
    if (!samsung) {
      console.error('Samsung brand not found');
      return;
    }
    console.log('Samsung brandId:', samsung.brandId);

    // 2. Find S25 Ultra modelId
    console.log('\n[2] Fetching models...');
    const modelData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/model/list', {
      brandId: samsung.brandId,
      categoryId: 1
    });
    
    const s25Ultra = modelData?.modelList?.find(m => 
      m.modelNameList?.some(n => n.modelName.toLowerCase().includes('s25 ultra'))
    );
    
    if (!s25Ultra) {
      console.error('Galaxy S25 Ultra not found');
      return;
    }
    console.log('S25 Ultra modelId:', s25Ultra.modelId);

    // 3. Get options (storage, condition, purchase location)
    console.log('\n[3] Fetching options for S25 Ultra...');
    const optionData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/option', {
      modelId: s25Ultra.modelId
    });
    
    // Find 1TB + best condition + HK option IDs
    console.log('Options response keys:', Object.keys(optionData || {}));
    
    // For now we log the structure so you can see the detailIds
    console.log('\n=== Option structure sample ===');
    console.log(JSON.stringify(optionData, null, 2).slice(0, 2000));

    // 4. Call price-cal (we need real detailIds - placeholder for now)
    console.log('\n[4] Calling /price-cal (placeholder detailIds)...');
    const pricePayload = {
      modelId: s25Ultra.modelId,
      detailIds: [1, 2, 3],           // ← replace with real IDs after inspecting the option response
      recyclePhoneImei: whitelistedImei,
      newPhoneModelCode: "18624007296"
    };
    
    const priceResult = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/price-cal', pricePayload);
    console.log('\nPrice result:', priceResult);

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

runTest();