/**
 * GasFree SDK Demo - 使用 @gasfree/gasfree-sdk 实现完整功能
 * 
 * 功能包含:
 * 1. tronGenerateGasFreeAddress - 生成 GasFree 账户地址
 * 2. tronGetGasFreeTransactionJson - 获取 EIP712 转账 JSON
 * 3. tronGetGasFreeLedgerRawHash - 获取 Ledger 签名所需的原始哈希
 * 4. 普通签名 - 使用私钥签名
 * 5. API 调用 - 与 GasFree Provider 交互
 * 
 * 使用方法:
 * 1. 先构建 SDK: cd gasfree-sdk-js && pnpm install && pnpm build
 * 2. 运行: node gasfree-sdk-demo.mjs
 * 
 * 参考文档: https://gasfree.io/specification-cn
 */

import 'dotenv/config';
import crypto from 'crypto';
import TronWebModule from 'tronweb';

// 导入官方 SDK (npm 包)
import gasFreeSDK from '@gasfree/gasfree-sdk';
const { TronGasFree } = gasFreeSDK;

// TronWeb v6 导出方式
const { TronWeb, utils: tronUtils } = TronWebModule;

// ==================== 配置区域 ====================

// GasFree API 配置 (从 .env 读取)
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌ 请在 .env 文件中配置 API_KEY 和 API_SECRET');
  process.exit(1);
}

// 网络配置
const NETWORK = 'nile'; // 'nile' 测试网 或 'tron' 主网

// Chain ID 配置
const CHAIN_IDS = {
  tron: Number('0x2b6653dc'),   // 728126428 - TRON 主网
  nile: Number('0xcd8690dc'),   // 3448148188 - Nile 测试网
  shasta: Number('0x94a9059e'), // 2494104990 - Shasta 测试网
};

// API 配置
const API_CONFIG = {
  nile: {
    baseUrl: 'https://open-test.gasfree.io',
    tronApiUrl: 'https://nile.trongrid.io',
    usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  },
  tron: {
    baseUrl: 'https://open.gasfree.io',
    tronApiUrl: 'https://api.trongrid.io',
    usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  },
};

const chainId = CHAIN_IDS[NETWORK];
const apiConfig = API_CONFIG[NETWORK];

// 初始化 TronWeb 实例
const tronWeb = new TronWeb({
  fullHost: apiConfig.tronApiUrl,
});

// ==================== 1. 账户工具函数 ====================

/**
 * 创建新的 TRON 账户 (EOA)
 */
function createAccount() {
  const account = tronUtils.accounts.generateAccount();
  return {
    address: account.address.base58,
    addressHex: account.address.hex,
    privateKey: account.privateKey,
    publicKey: account.publicKey,
  };
}

/**
 * 从私钥恢复账户
 */
function accountFromPrivateKey(privateKey) {
  const address = tronWeb.address.fromPrivateKey(privateKey);
  return {
    address: address,
    addressHex: tronWeb.address.toHex(address),
    privateKey: privateKey,
  };
}

// ==================== 2. GasFree SDK 功能封装 ====================

/**
 * 生成 GasFree 地址
 * 对应 demo: tronGenerateGasFreeAddress
 */
function generateGasFreeAddress(userAddress) {
  const tronGasFree = new TronGasFree({ chainId });
  return tronGasFree.generateGasFreeAddress(userAddress);
}

/**
 * 获取 GasFree 转账 JSON (用于普通钱包签名)
 * 对应 demo: tronGetGasFreeTransactionJson
 */
function getGasFreeTransactionJson({
  token,
  serviceProvider,
  user,
  receiver,
  value,
  maxFee,
  deadline,
  nonce,
}) {
  const tronGasFree = new TronGasFree({ chainId });
  return tronGasFree.assembleGasFreeTransactionJson({
    token,
    serviceProvider,
    user,
    receiver,
    value: value.toString(),
    maxFee: maxFee.toString(),
    deadline: deadline.toString(),
    version: '1',
    nonce: nonce.toString(),
  });
}

/**
 * 获取 Ledger 签名所需的原始哈希
 * 对应 demo: tronGetGasFreeLedgerRawHash
 */
function getGasFreeLedgerRawHash(message) {
  const tronGasFree = new TronGasFree({ chainId });
  return tronGasFree.getGasFreeLedgerRawHash({ message });
}

/**
 * 使用私钥签名 GasFree 转账
 */
async function signGasFreeTransfer(privateKey, {
  token,
  serviceProvider,
  user,
  receiver,
  value,
  maxFee,
  deadline,
  nonce,
}) {
  const { domain, types, message } = getGasFreeTransactionJson({
    token,
    serviceProvider,
    user,
    receiver,
    value,
    maxFee,
    deadline,
    nonce,
  });
  
  // 使用 TronWeb 的 typedData 签名
  const signature = tronUtils.typedData.signTypedData(domain, types, message, privateKey);
  
  return {
    domain,
    types,
    message,
    signature: signature.startsWith('0x') ? signature.slice(2) : signature,
  };
}

// ==================== 3. API 鉴权 ====================

/**
 * 生成 API 签名
 */
function generateApiSignature(method, path, timestamp) {
  const message = `${method}${path}${timestamp}`;
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(message)
    .digest('base64');
}

/**
 * 生成带鉴权的请求头
 */
function getAuthHeaders(method, path) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateApiSignature(method, path, timestamp);
  
  return {
    'Content-Type': 'application/json',
    'Timestamp': timestamp.toString(),
    'Authorization': `ApiKey ${API_KEY}:${signature}`,
  };
}

// ==================== 4. API 调用 ====================

/**
 * 通用 API 请求函数
 */
async function apiRequest(method, apiPath, body = null) {
  const fullPath = `/${NETWORK}${apiPath}`;
  const headers = getAuthHeaders(method, fullPath);
  const url = `${apiConfig.baseUrl}${fullPath}`;
  
  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API 请求失败:', error.message);
    throw error;
  }
}

/** 获取支持的 Token 列表 */
async function getSupportedTokens() {
  return await apiRequest('GET', '/api/v1/config/token/all');
}

/** 获取 Service Provider 列表 */
async function getProviders() {
  return await apiRequest('GET', '/api/v1/config/provider/all');
}

/** 查询 GasFree 账户信息 */
async function getGasFreeAccountInfo(accountAddress) {
  return await apiRequest('GET', `/api/v1/address/${accountAddress}`);
}

/** 提交 GasFree 转账授权 */
async function submitGasFreeTransfer(transferParams) {
  return await apiRequest('POST', '/api/v1/gasfree/submit', transferParams);
}

/** 查询 GasFree 转账状态 */
async function getTransferStatus(traceId) {
  return await apiRequest('GET', `/api/v1/gasfree/${traceId}`);
}

// ==================== 5. 完整流程示例 ====================

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           GasFree SDK Demo - 使用 @gasfree/gasfree-sdk          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`当前网络: ${NETWORK === 'nile' ? 'TRON Nile 测试网' : 'TRON 主网'}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`API 基础地址: ${apiConfig.baseUrl}\n`);
  
  // ========== 1. 创建 EOA 账户 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 1: 创建 EOA 账户');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const account = createAccount();
  console.log('✓ 新账户已创建');
  console.log(`  地址 (Base58): ${account.address}`);
  console.log(`  私钥: ${account.privateKey}`);
  console.log();
  
  // ========== 2. tronGenerateGasFreeAddress ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 2: tronGenerateGasFreeAddress - 生成 GasFree 地址');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const gasFreeAddress = generateGasFreeAddress(account.address);
    console.log('✓ GasFree 地址生成成功');
    console.log(`  用户 EOA 地址:    ${account.address}`);
    console.log(`  GasFree 账户地址: ${gasFreeAddress}`);
  } catch (error) {
    console.log(`✗ 生成失败: ${error.message}`);
  }
  console.log();
  
  // ========== 3. tronGetGasFreeTransactionJson ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 3: tronGetGasFreeTransactionJson - 获取转账 JSON');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 使用 Nile 测试网真实的 Provider 地址
  const exampleProvider = 'TKtWbdzEq5ss9vTS9kwRhBp5mXmBfBns3E'; // gasfree-provider
  const exampleReceiver = 'TJM1BE5wq1VdHh3gwjUeyaVkvZp9DVYCfC';
  const deadline = Math.floor(Date.now() / 1000) + 180;
  
  try {
    const txJson = getGasFreeTransactionJson({
      token: apiConfig.usdtAddress,
      serviceProvider: exampleProvider,
      user: account.address,
      receiver: exampleReceiver,
      value: '90000000',   // 90 USDT
      maxFee: '20000000',  // 最大 20 USDT 手续费
      deadline: deadline,
      nonce: 0,
    });
    
    console.log('✓ 转账 JSON 生成成功');
    console.log('\nDomain:');
    console.log(JSON.stringify(txJson.domain, null, 2));
    console.log('\nTypes:');
    console.log(JSON.stringify(txJson.types, null, 2));
    console.log('\nMessage:');
    console.log(JSON.stringify(txJson.message, null, 2));
  } catch (error) {
    console.log(`✗ 生成失败: ${error.message}`);
  }
  console.log();
  
  // ========== 4. tronGetGasFreeLedgerRawHash ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 4: tronGetGasFreeLedgerRawHash - 获取 Ledger 签名哈希');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Ledger 签名需要使用 Ethereum 格式地址
  const tronToEthAddress = (addr) => '0x' + tronWeb.address.toHex(addr).slice(2);
  
  try {
    const ledgerMessage = {
      token: tronToEthAddress(apiConfig.usdtAddress),
      serviceProvider: tronToEthAddress(exampleProvider),
      user: tronToEthAddress(account.address),
      receiver: tronToEthAddress(exampleReceiver),
      value: '90000000',
      maxFee: '20000000',
      deadline: deadline.toString(),
      version: '1',
      nonce: '0',
    };
    
    const { domainSeparatorHex, hashStructMessageHex, permitTransferMessageHash } = 
      getGasFreeLedgerRawHash(ledgerMessage);
    
    console.log('✓ Ledger 签名哈希生成成功');
    console.log(`  Domain Separator: ${domainSeparatorHex}`);
    console.log(`  Struct Hash:      ${hashStructMessageHex}`);
    console.log(`  Message Hash:     ${permitTransferMessageHash}`);
    console.log('\n提示: 使用 Ledger 时，将 permitTransferMessageHash 传给 app.signTransactionHash()');
  } catch (error) {
    console.log(`✗ 生成失败: ${error.message}`);
  }
  console.log();
  
  // ========== 5. 普通钱包签名 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 5: 使用私钥签名 GasFree 转账');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const signResult = await signGasFreeTransfer(account.privateKey, {
      token: apiConfig.usdtAddress,
      serviceProvider: exampleProvider,
      user: account.address,
      receiver: exampleReceiver,
      value: '90000000',
      maxFee: '20000000',
      deadline: deadline,
      nonce: 0,
    });
    
    console.log('✓ 签名成功');
    console.log(`  签名: ${signResult.signature}`);
    console.log(`  签名长度: ${signResult.signature.length} 字符`);
  } catch (error) {
    console.log(`✗ 签名失败: ${error.message}`);
  }
  console.log();
  
  // ========== 6. API 调用 - 获取配置 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 6: API 调用 - 获取配置信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let activateFee = 2000000;
  let transferFee = 50000;
  
  console.log('获取支持的 Token 列表...');
  try {
    const tokensResult = await getSupportedTokens();
    if (tokensResult.code === 200) {
      console.log('✓ Token 列表:');
      tokensResult.data.tokens.forEach(token => {
        const decimal = Math.pow(10, token.decimal);
        console.log(`  - ${token.symbol} (${token.tokenAddress})`);
        console.log(`    激活费: ${token.activateFee / decimal}, 转账费: ${token.transferFee / decimal}`);
        if (token.tokenAddress === apiConfig.usdtAddress) {
          activateFee = token.activateFee;
          transferFee = token.transferFee;
        }
      });
    } else {
      console.log(`✗ 获取失败: ${tokensResult.message || tokensResult.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  
  console.log('\n获取 Provider 列表...');
  try {
    const providersResult = await getProviders();
    if (providersResult.code === 200) {
      console.log('✓ Provider 列表:');
      providersResult.data.providers.forEach(p => {
        console.log(`  - ${p.name} (${p.address})`);
        console.log(`    Deadline 范围: ${p.config.minDeadlineDuration}s - ${p.config.maxDeadlineDuration}s`);
      });
    } else {
      console.log(`✗ 获取失败: ${providersResult.message || providersResult.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  console.log();
  
  // ========== 7. API 调用 - 查询账户 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 7: API 调用 - 查询 GasFree 账户信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let accountInfo = null;
  try {
    accountInfo = await getGasFreeAccountInfo(account.address);
    if (accountInfo.code === 200) {
      console.log('✓ GasFree 账户信息:');
      console.log(`  EOA 地址:      ${accountInfo.data.accountAddress}`);
      console.log(`  GasFree 地址:  ${accountInfo.data.gasFreeAddress}`);
      console.log(`  是否激活:      ${accountInfo.data.active ? '是' : '否'}`);
      console.log(`  当前 Nonce:    ${accountInfo.data.nonce}`);
      console.log(`  允许提交:      ${accountInfo.data.allowSubmit ? '是' : '否'}`);
    } else {
      console.log(`✗ 查询失败: ${accountInfo.message || accountInfo.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  console.log();
  
  // ========== 8. 账户激活流程说明 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 8: 账户激活流程 (说明)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('账户激活完整流程:');
  console.log('');
  console.log('Step 1: EOA 向 GasFree 地址转入 USDT (普通 TRC20 转账)');
  console.log('  - 转账金额需要 >= 激活费 + 转账费 + 实际转账金额');
  console.log(`  - 当前激活费: ${activateFee / 1e6} USDT`);
  console.log(`  - 当前转账费: ${transferFee / 1e6} USDT`);
  console.log('');
  console.log('Step 2: 提交首次 GasFree 转账 (触发激活)');
  console.log('  - 首次提交时 maxFee = 激活费 + 转账费');
  console.log('  - 可以转给自己，用于激活账户');
  console.log('');
  console.log('激活转账示例请求体:');
  
  const activateRequest = {
    requestId: crypto.randomUUID(),
    token: apiConfig.usdtAddress,
    serviceProvider: exampleProvider,
    user: account.address,
    receiver: account.address, // 转回自己
    value: 100000,  // 0.1 USDT
    maxFee: activateFee + transferFee,  // 激活费 + 转账费
    deadline: Math.floor(Date.now() / 1000) + 180,
    version: 1,
    nonce: 0,  // 首次转账 nonce = 0
    sig: '<EIP712签名>',
  };
  
  console.log(JSON.stringify(activateRequest, null, 2));
  console.log('');
  console.log('Step 3: 等待激活完成，查询状态');
  console.log('  - 使用 GET /api/v1/gasfree/{traceId} 查询');
  console.log('  - 状态变为 SUCCEED 表示激活成功');
  console.log('');
  console.log('Step 4: 激活后，后续转账只需支付转账费');
  console.log(`  - 后续 maxFee = ${transferFee / 1e6} USDT`);
  console.log();
  
  // ========== 9. 查询转账状态 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 9: API 调用 - 查询转账状态');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const exampleTraceId = 'd031f237-9334-491d-847a-fd2b87600e4b'; // 已成功的示例
  console.log(`查询 traceId: ${exampleTraceId}`);
  try {
    const statusResult = await getTransferStatus(exampleTraceId);
    if (statusResult.code === 200 && statusResult.data) {
      console.log('✓ 转账状态:');
      console.log(`  traceId: ${statusResult.data.id}`);
      console.log(`  状态: ${statusResult.data.state}`);
      console.log(`  金额: ${(statusResult.data.txnAmount || statusResult.data.amount) / 1e6} USDT`);
      if (statusResult.data.txnHash) {
        console.log(`  交易哈希: ${statusResult.data.txnHash}`);
      }
      if (statusResult.data.txnTotalFee) {
        console.log(`  总费用: ${statusResult.data.txnTotalFee / 1e6} USDT`);
      }
    } else {
      console.log(`✗ 查询失败: ${statusResult.message || statusResult.reason || '转账记录不存在'}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  console.log();
  
  // ========== 10. 完整转账请求示例 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo 10: 完整转账请求体结构 (已激活账户)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const transferRequest = {
    requestId: crypto.randomUUID(),
    token: apiConfig.usdtAddress,
    serviceProvider: exampleProvider,
    user: account.address,
    receiver: exampleReceiver,
    value: 90000000,       // 90 USDT
    maxFee: transferFee,   // 已激活账户只需转账费
    deadline: deadline,
    version: 1,
    nonce: 1,              // 已激活账户 nonce >= 1
    sig: '<EIP712签名>',
  };
  
  console.log('POST /api/v1/gasfree/submit 请求体:');
  console.log(JSON.stringify(transferRequest, null, 2));
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      GasFree SDK Demo 结束                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  console.log('\n📝 完整流程总结:');
  console.log('1. 创建 EOA 账户');
  console.log('2. 通过 API 获取 GasFree 地址');
  console.log('3. EOA 向 GasFree 地址转入 USDT');
  console.log('4. 提交首次转账触发激活 (maxFee = 激活费 + 转账费)');
  console.log('5. 后续转账只需转账费 (maxFee = 转账费)');
  
  console.log('\n🔗 相关链接:');
  console.log('  - 测试网水龙头: https://nileex.io/join/getJoinPage');
  console.log('  - 资产提取页面: https://test.gasfree.io/withdraw');
  console.log('  - 开发者文档: https://gasfree.io/specification-cn');
  
  console.log('\n💡 运行完整测试:');
  console.log('  npm run nile-test  (需要配置 .env 中的 PRIVATE_KEY)');
}

// ==================== 导出函数 ====================

export {
  // 账户相关
  createAccount,
  accountFromPrivateKey,
  
  // GasFree SDK 功能
  generateGasFreeAddress,
  getGasFreeTransactionJson,
  getGasFreeLedgerRawHash,
  signGasFreeTransfer,
  
  // API 相关
  getSupportedTokens,
  getProviders,
  getGasFreeAccountInfo,
  submitGasFreeTransfer,
  getTransferStatus,
  
  // 工具函数
  generateApiSignature,
  getAuthHeaders,
  
  // 配置
  CHAIN_IDS,
  API_CONFIG,
};

// ==================== 运行 Demo ====================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo().catch(console.error);
}
