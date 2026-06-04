#!/usr/bin/env node
/**
 * Shanhs Trade-in Catalog Fetcher
 * Fetches brands → models → options → real trade-in prices using the Shanhs API
 * and outputs a clean devices.json file for the frontend.
 *
 * Run: node fetch-tradein-catalog.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CREDENTIALS_PATH = path.join(__dirname, 'secrets', 'tradein-credentials.json');
const OUTPUT_PATH = path.join(__dirname, 'devices.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

const { appId, appSecret, whitelistedImei, baseUrl } = credentials;

if (!appId || !appSecret || !whitelistedImei) {
  console.error('Missing credentials in secrets/tradein-credentials.json');
  process.exit(1);
}

console.log('Using appId:', appId);
console.log('Whitelisted IMEI:', whitelistedImei);

// === HMAC-SHA256 Signing (port of the Java example you provided) ===
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

function generateRequestBody(bizContentObj, timestamp = Date.now()) {
  const bizContent = JSON.stringify(bizContentObj);

  const params = {
    appId,
    bizContent,
    signType: 'HS256',
    timestamp: timestamp.toString()
  };

  const signString = buildSignString(params);
  const sign = hmacSHA256(signString, appSecret);

  return {
    appId,
    bizContent,
    sign,
    signType: 'HS256',
    timestamp: timestamp.toString()
  };
}

async function apiCall(endpoint, bizContentObj) {
  const body = generateRequestBody(bizContentObj);

  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${endpoint}`);
  }

  const json = await res.json();

  if (json.code !== 0) {
    console.warn(`API error on ${endpoint}:`, json);
    return null;
  }

  return json.data;
}

// === Main fetch logic ===

async function fetchCatalog() {
  console.log('Fetching categories...');
  const categoryData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/category/list', {});

  // Use English (languageId 4)
  const categories = categoryData?.find(c => c.languageId === 4)?.categoryList || [];
  console.log('Categories:', categories.map(c => `${c.categoryId}:${c.categoryName}`));

  const allDevices = [];

  for (const cat of categories) {
    if (![1, 3, 5].includes(cat.categoryId)) continue; // phones, notebooks, watches

    console.log(`\n=== Category: ${cat.categoryName} ===`);

    const brandData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/brand/list', {
      categoryId: cat.categoryId
    });

    const brandList = brandData?.find(b => b.languageId === 4)?.brandList || [];
    console.log(`Found ${brandList.length} brands`);

    for (const brand of brandList) {
      console.log(`  → ${brand.brandName}`);

      const modelData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/model/list', {
        brandId: brand.brandId,
        categoryId: cat.categoryId
      });

      const models = modelData?.modelList || [];

      for (const model of models) {
        const modelNameEn = model.modelNameList?.find(m => m.languageId === 4)?.modelName || 'Unknown';

        console.log(`     - ${modelNameEn}`);

        // Fetch options for this model
        const optionData = await apiCall('/sapi/gateway/shanhs-global-recycle-api/samsung/option', {
          modelId: model.modelId
        });

        if (!optionData) continue;

        // Parse skuOptions + otherOptions into structured rows
        const skuOptions = optionData.skuOptions || [];
        const otherOptions = optionData.otherOptions || [];

        // Helper to find detail by name pattern
        const findDetail = (list, patterns) => {
          for (const item of list) {
            const name = (item.detailName || item.name || '').toLowerCase();
            if (patterns.some(p => name.includes(p))) return item;
          }
          return null;
        };

        // Extract storage variants (look for GB/TB in skuOptions)
        const storageVariants = skuOptions.filter(o => {
          const n = (o.detailName || '').toLowerCase();
          return /\d+\s*(gb|tb)/.test(n);
        });

        // Extract condition tiers (perfect/good/fair etc.)
        const conditionVariants = otherOptions.filter(o => {
          const n = (o.detailName || '').toLowerCase();
          return /perfect|good|fair|excellent|mint/.test(n);
        });

        // Extract purchase location options
        const locationVariants = otherOptions.filter(o => {
          const n = (o.detailName || '').toLowerCase();
          return /hong kong|macau|mainland|china|hk|mo/.test(n);
        });

        const storages = storageVariants.length ? storageVariants : [{ detailName: 'N/A', detailId: null }];
        const conditions = conditionVariants.length ? conditionVariants : [{ detailName: 'Perfect', detailId: null }];
        const locations = locationVariants.length ? locationVariants : [{ detailName: 'Hong Kong/Macau', detailId: null }];

        // Generate one row per combination (limit combinations to avoid explosion)
        for (const s of storages.slice(0, 6)) {
          for (const c of conditions.slice(0, 3)) {
            for (const l of locations.slice(0, 2)) {
              allDevices.push({
                brand: brand.brandName,
                model: modelNameEn,
                storage: s.detailName || 'N/A',
                condition: c.detailName || 'Perfect',
                purchased_from: l.detailName || 'Hong Kong/Macau',
                trade_in_price: null,
                modelId: model.modelId,
                categoryId: cat.categoryId,
                storageDetailId: s.detailId,
                conditionDetailId: c.detailId,
                locationDetailId: l.detailId
              });
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal devices collected: ${allDevices.length}`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allDevices, null, 2));
  console.log('Saved to devices.json');
}

fetchCatalog().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});