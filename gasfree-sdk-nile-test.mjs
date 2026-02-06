/**
 * GasFree SDK Nile 测试网完整测试脚本
 * 
 * 完整流程:
 * 1. 从 .env 读取主账户私钥
 * 2. 生成新的测试账户
 * 3. 通过 API 获取 GasFree 账户地址
 * 4. 主账户向 GasFree 地址转入 USDT
 * 5. 提交激活转账 (首次转账自动激活，扣除激活费)
 * 6. 查询账户信息 (确认已激活)
 * 7. 提交正式转账：从 GasFree 转回主账户
 * 8. 查询转账状态
 * 9. 最终余额检查
 * 
 * 使用方法:
 * 1. 复制 .env.example 为 .env，填入私钥
 * 2. npm install
 * 3. npm run nile-test
 */

import 'dotenv/config';
import crypto from 'crypto';
import TronWebModule from 'tronweb';
import gasFreeSDK from '@gasfree/gasfree-sdk';

const { TronGasFree } = gasFreeSDK;
const { TronWeb, utils: tronUtils } = TronWebModule;

// ==================== 配置 ====================

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const TRANSFER_AMOUNT = parseInt(process.env.TRANSFER_AMOUNT || '5'); // 5 USDT

const NETWORK = 'nile';
const CHAIN_ID = Number('0xcd8690dc');

const CONFIG = {
  baseUrl: 'https://open-test.gasfree.io',
  tronApiUrl: 'https://nile.trongrid.io',
  usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
};

let tronWeb;

// ==================== 工具函数 ====================

function log(message, type = 'info') {
  const prefix = { info: '📌', success: '✅', error: '❌', wait: '⏳', money: '💰' };
  console.log(`${prefix[type] || '▸'} ${message}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const formatUsdt = (amount) => (amount / 1e6).toFixed(6);

// ==================== API ====================

function getAuthHeaders(method, path) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', API_SECRET)
    .update(`${method}${path}${timestamp}`).digest('base64');
  return {
    'Content-Type': 'application/json',
    'Timestamp': timestamp.toString(),
    'Authorization': `ApiKey ${API_KEY}:${signature}`,
  };
}

async function apiRequest(method, apiPath, body = null) {
  const fullPath = `/${NETWORK}${apiPath}`;
  const url = `${CONFIG.baseUrl}${fullPath}`;
  const options = { method, headers: getAuthHeaders(method, fullPath) };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  return await response.json();
}

// ==================== GasFree ====================

function generateGasFreeAddress(userAddress) {
  return new TronGasFree({ chainId: CHAIN_ID }).generateGasFreeAddress(userAddress);
}

function signGasFreeTransfer(privateKey, params) {
  const tronGasFree = new TronGasFree({ chainId: CHAIN_ID });
  const { domain, types, message } = tronGasFree.assembleGasFreeTransactionJson({
    token: params.token,
    serviceProvider: params.serviceProvider,
    user: params.user,
    receiver: params.receiver,
    value: params.value.toString(),
    maxFee: params.maxFee.toString(),
    deadline: params.deadline.toString(),
    version: '1',
    nonce: params.nonce.toString(),
  });
  const signature = tronUtils.typedData.signTypedData(domain, types, message, privateKey);
  return { signature: signature.startsWith('0x') ? signature.slice(2) : signature };
}

// ==================== TRC20 ====================

async function getUsdtBalance(address) {
  try {
    const contract = await tronWeb.contract().at(CONFIG.usdtAddress);
    return BigInt((await contract.balanceOf(address).call()).toString());
  } catch { return 0n; }
}

async function transferUsdt(toAddress, amount) {
  const contract = await tronWeb.contract().at(CONFIG.usdtAddress);
  return await contract.transfer(toAddress, amount).send();
}

async function waitForTransaction(txId, maxAttempts = 30) {
  log(`等待交易确认: ${txId}`, 'wait');
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info?.receipt?.result === 'SUCCESS') return { success: true };
      if (info?.receipt) return { success: false, error: 'Failed' };
    } catch {}
    process.stdout.write('.');
  }
  console.log();
  return { success: false, error: 'Timeout' };
}

// ==================== GasFree 提交与轮询 ====================

async function submitAndWaitGasFree(params, description = '转账') {
  const { signature } = signGasFreeTransfer(params.privateKey, params);
  
  const submitBody = {
    requestId: crypto.randomUUID(),
    token: CONFIG.usdtAddress,
    serviceProvider: params.serviceProvider,
    user: params.user,
    receiver: params.receiver,
    value: params.value,
    maxFee: params.maxFee,
    deadline: params.deadline,
    version: 1,
    nonce: params.nonce,
    sig: signature,
  };

  log(`提交 ${description}...`, 'wait');
  const result = await apiRequest('POST', '/api/v1/gasfree/submit', submitBody);
  
  if (result.code !== 200) {
    log(`提交失败: ${result.message || result.reason}`, 'error');
    return { success: false, error: result.message || result.reason };
  }

  const traceId = result.data.id;
  log(`提交成功! traceId: ${traceId}`, 'success');

  // 轮询状态
  const SUCCESS_STATES = ['SUCCEED', 'SUCCESS', 3];
  const FAILED_STATES = ['FAILED', 'EXPIRED', 'CANCELED', 4, 5, 6];

  for (let i = 0; i < 20; i++) {
    await sleep(5000);
    const status = await apiRequest('GET', `/api/v1/gasfree/${traceId}`);
    
    if (status.code === 200 && status.data) {
      const state = status.data.state;
      log(`[${i + 1}/20] 状态: ${state}`);
      
      if (SUCCESS_STATES.includes(state)) {
        log(`${description}成功!`, 'success');
        console.log(`    交易哈希: ${status.data.txnHash}`);
        console.log(`    金额: ${formatUsdt(status.data.txnAmount || status.data.amount)} USDT`);
        if (status.data.txnTotalFee) {
          console.log(`    总费用: ${formatUsdt(status.data.txnTotalFee)} USDT`);
        }
        return { success: true, data: status.data, traceId };
      }
      
      if (FAILED_STATES.includes(state)) {
        log(`${description}失败! 状态: ${state}`, 'error');
        return { success: false, error: state, traceId };
      }
    }
  }
  
  log('查询超时', 'wait');
  return { success: false, error: 'Timeout', traceId };
}

// ==================== 主流程 ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       GasFree SDK - Nile 测试网完整流程测试                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (!PRIVATE_KEY || !API_KEY || !API_SECRET) {
    log('请在 .env 文件中配置 PRIVATE_KEY, API_KEY, API_SECRET', 'error');
    process.exit(1);
  }

  tronWeb = new TronWeb({ fullHost: CONFIG.tronApiUrl, privateKey: PRIVATE_KEY });
  const mainAddress = tronWeb.address.fromPrivateKey(PRIVATE_KEY);

  // ========== Step 1: 主账户信息 ==========
  console.log('━'.repeat(60));
  log('Step 1: 主账户信息');
  console.log('━'.repeat(60));
  
  const mainBalance = await getUsdtBalance(mainAddress);
  log(`主账户地址: ${mainAddress}`);
  log(`主账户 USDT 余额: ${formatUsdt(Number(mainBalance))} USDT`, 'money');
  
  const transferAmountSun = BigInt(TRANSFER_AMOUNT) * 1000000n;
  if (mainBalance < transferAmountSun) {
    log(`余额不足! 需要 ${TRANSFER_AMOUNT} USDT`, 'error');
    process.exit(1);
  }
  console.log();

  // ========== Step 2: 创建测试账户 ==========
  console.log('━'.repeat(60));
  log('Step 2: 创建新的测试账户');
  console.log('━'.repeat(60));
  
  const newAccount = tronUtils.accounts.generateAccount();
  const testAddress = newAccount.address.base58;
  const testPrivateKey = newAccount.privateKey;
  
  log(`测试账户 EOA: ${testAddress}`, 'success');
  log(`测试账户私钥: ${testPrivateKey}`);
  console.log();

  // ========== Step 3: 获取 GasFree 地址 ==========
  console.log('━'.repeat(60));
  log('Step 3: 通过 API 获取 GasFree 账户地址');
  console.log('━'.repeat(60));
  
  const accountInfo = await apiRequest('GET', `/api/v1/address/${testAddress}`);
  if (accountInfo.code !== 200) {
    log(`获取失败: ${accountInfo.message}`, 'error');
    process.exit(1);
  }
  
  const gasFreeAddress = accountInfo.data.gasFreeAddress;
  log(`GasFree 地址: ${gasFreeAddress}`, 'success');
  console.log(`    是否激活: ${accountInfo.data.active ? '是' : '否'}`);
  console.log(`    Nonce: ${accountInfo.data.nonce}`);
  
  // 验证 SDK 计算
  const sdkAddress = generateGasFreeAddress(testAddress);
  if (sdkAddress === gasFreeAddress) {
    log('SDK 计算地址一致 ✓', 'success');
  }
  console.log();

  // ========== Step 4: 向 GasFree 地址转入 USDT ==========
  console.log('━'.repeat(60));
  log(`Step 4: 向 GasFree 地址转入 ${TRANSFER_AMOUNT} USDT`);
  console.log('━'.repeat(60));
  
  log(`从 ${mainAddress.slice(0,10)}... 转账到 ${gasFreeAddress.slice(0,10)}...`);
  
  try {
    const txId = await transferUsdt(gasFreeAddress, transferAmountSun.toString());
    log(`交易已发送: ${txId}`, 'success');
    const result = await waitForTransaction(txId);
    if (!result.success) {
      log(`转账失败: ${result.error}`, 'error');
      process.exit(1);
    }
    log('USDT 转账成功!', 'success');
  } catch (e) {
    log(`转账失败: ${e.message}`, 'error');
    process.exit(1);
  }
  
  log('等待系统同步...', 'wait');
  await sleep(5000);
  console.log();

  // ========== Step 5: 获取配置信息 ==========
  console.log('━'.repeat(60));
  log('Step 5: 获取 Provider 和费用信息');
  console.log('━'.repeat(60));
  
  const providersResult = await apiRequest('GET', '/api/v1/config/provider/all');
  if (providersResult.code !== 200 || !providersResult.data.providers.length) {
    log('获取 Provider 失败', 'error');
    process.exit(1);
  }
  const provider = providersResult.data.providers[0];
  log(`Provider: ${provider.name} (${provider.address})`, 'success');

  const tokensResult = await apiRequest('GET', '/api/v1/config/token/all');
  const usdtToken = tokensResult.data?.tokens?.find(t => t.tokenAddress === CONFIG.usdtAddress);
  const activateFee = usdtToken?.activateFee || 2000000;
  const transferFee = usdtToken?.transferFee || 50000;
  
  log(`激活费: ${formatUsdt(activateFee)} USDT`);
  log(`转账费: ${formatUsdt(transferFee)} USDT`);
  console.log();

  // ========== Step 6: 激活账户 ==========
  console.log('━'.repeat(60));
  log('Step 6: 激活账户 (首次提交 GasFree 转账)');
  console.log('━'.repeat(60));
  
  // 检查是否已激活
  const preActivateInfo = await apiRequest('GET', `/api/v1/address/${testAddress}`);
  
  if (preActivateInfo.data?.active) {
    log('账户已激活，跳过激活步骤', 'success');
  } else {
    // 激活转账: 转一小笔回自己，主要是触发激活
    const activateAmount = 100000; // 0.1 USDT
    const activateMaxFee = activateFee + transferFee;
    const activateDeadline = Math.floor(Date.now() / 1000) + 180;
    
    log('提交激活转账 (转回自己触发激活)');
    console.log(`    金额: ${formatUsdt(activateAmount)} USDT`);
    console.log(`    最大费用: ${formatUsdt(activateMaxFee)} USDT (激活费+转账费)`);
    
    const activateResult = await submitAndWaitGasFree({
      privateKey: testPrivateKey,
      token: CONFIG.usdtAddress,
      serviceProvider: provider.address,
      user: testAddress,
      receiver: testAddress, // 转回自己
      value: activateAmount,
      maxFee: activateMaxFee,
      deadline: activateDeadline,
      nonce: 0,
    }, '激活转账');
    
    if (!activateResult.success) {
      log('激活失败', 'error');
      process.exit(1);
    }
  }
  console.log();

  // ========== Step 7: 查询激活后账户信息 ==========
  console.log('━'.repeat(60));
  log('Step 7: 查询账户信息 (确认已激活)');
  console.log('━'.repeat(60));
  
  await sleep(3000);
  const postActivateInfo = await apiRequest('GET', `/api/v1/address/${testAddress}`);
  
  if (postActivateInfo.code === 200) {
    log('账户信息:', 'success');
    console.log(`    是否激活: ${postActivateInfo.data.active ? '是 ✓' : '否 ✗'}`);
    console.log(`    Nonce: ${postActivateInfo.data.nonce}`);
    console.log(`    允许提交: ${postActivateInfo.data.allowSubmit ? '是' : '否'}`);
  }
  console.log();

  // ========== Step 8: 提交正式转账 ==========
  console.log('━'.repeat(60));
  log('Step 8: 提交正式转账 (转回主账户)');
  console.log('━'.repeat(60));
  
  // 获取当前 nonce
  const currentNonce = postActivateInfo.data?.nonce || 1;
  
  // 查询 GasFree 地址余额
  const gasFreeBalance = await getUsdtBalance(gasFreeAddress);
  log(`GasFree 账户余额: ${formatUsdt(Number(gasFreeBalance))} USDT`, 'money');
  
  // 转账金额 = 余额 - 转账费 - 留一点
  const transferValue = Number(gasFreeBalance) - transferFee - 100000; // 留 0.1 USDT
  
  if (transferValue <= 0) {
    log('余额不足以进行转账', 'error');
    process.exit(1);
  }
  
  const transferDeadline = Math.floor(Date.now() / 1000) + 180;
  
  log('转账参数:');
  console.log(`    从: ${testAddress} (GasFree)`);
  console.log(`    到: ${mainAddress}`);
  console.log(`    金额: ${formatUsdt(transferValue)} USDT`);
  console.log(`    手续费: ${formatUsdt(transferFee)} USDT`);
  console.log(`    Nonce: ${currentNonce}`);
  
  const transferResult = await submitAndWaitGasFree({
    privateKey: testPrivateKey,
    token: CONFIG.usdtAddress,
    serviceProvider: provider.address,
    user: testAddress,
    receiver: mainAddress,
    value: transferValue,
    maxFee: transferFee,
    deadline: transferDeadline,
    nonce: currentNonce,
  }, '正式转账');
  
  console.log();

  // ========== Step 9: 最终余额检查 ==========
  console.log('━'.repeat(60));
  log('Step 9: 最终余额检查');
  console.log('━'.repeat(60));
  
  const finalMainBalance = await getUsdtBalance(mainAddress);
  const finalGasFreeBalance = await getUsdtBalance(gasFreeAddress);
  
  log(`主账户最终余额: ${formatUsdt(Number(finalMainBalance))} USDT`, 'money');
  log(`GasFree 账户最终余额: ${formatUsdt(Number(finalGasFreeBalance))} USDT`, 'money');
  
  console.log('\n' + '═'.repeat(60));
  console.log('📝 测试总结:');
  console.log(`    主账户: ${mainAddress}`);
  console.log(`    测试账户: ${testAddress}`);
  console.log(`    GasFree 地址: ${gasFreeAddress}`);
  console.log(`    转入金额: ${TRANSFER_AMOUNT} USDT`);
  console.log(`    激活费: ${formatUsdt(activateFee)} USDT`);
  console.log(`    转账费: ${formatUsdt(transferFee)} USDT`);
  
  if (transferResult.success) {
    console.log('\n🎉 GasFree 完整流程测试成功!');
  }
}

main().catch(e => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});
