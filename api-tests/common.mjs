/**
 * GasFree API 公共模块
 * 包含配置、鉴权、请求函数
 */

import 'dotenv/config';
import crypto from 'crypto';

// ==================== 配置 ====================

export const API_KEY = process.env.API_KEY;
export const API_SECRET = process.env.API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌ 请在 .env 文件中配置 API_KEY 和 API_SECRET');
  process.exit(1);
}
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

export const NETWORK = 'nile';
export const CHAIN_ID = Number('0xcd8690dc'); // 3448148188

export const CONFIG = {
  baseUrl: 'https://open-test.gasfree.io',
  tronApiUrl: 'https://nile.trongrid.io',
  usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
};

// ==================== API 鉴权 ====================

export function generateApiSignature(method, path, timestamp) {
  const message = `${method}${path}${timestamp}`;
  return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

export function getAuthHeaders(method, path) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateApiSignature(method, path, timestamp);
  return {
    'Content-Type': 'application/json',
    'Timestamp': timestamp.toString(),
    'Authorization': `ApiKey ${API_KEY}:${signature}`,
  };
}

// ==================== API 请求 ====================

export async function apiRequest(method, apiPath, body = null) {
  const fullPath = `/${NETWORK}${apiPath}`;
  const headers = getAuthHeaders(method, fullPath);
  const url = `${CONFIG.baseUrl}${fullPath}`;
  
  console.log(`\n📡 ${method} ${url}`);
  console.log('Headers:', JSON.stringify(headers, null, 2));
  
  if (body) {
    console.log('Body:', JSON.stringify(body, null, 2));
  }
  
  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    console.log(`\n📥 Response Status: ${response.status}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch {
      console.log('Response Body (raw):', responseText);
      data = { raw: responseText };
    }
    
    return { status: response.status, data };
  } catch (error) {
    console.error('❌ Request Error:', error.message);
    throw error;
  }
}

// ==================== 工具函数 ====================

export function formatUsdt(amount) {
  return (amount / 1e6).toFixed(6);
}

export function log(message, type = 'info') {
  const prefix = {
    info: '📌',
    success: '✅',
    error: '❌',
    wait: '⏳',
  };
  console.log(`${prefix[type] || '▸'} ${message}`);
}
