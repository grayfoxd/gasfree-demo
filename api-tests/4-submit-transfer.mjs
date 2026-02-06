/**
 * API 测试 4: POST /api/v1/gasfree/submit
 * 提交 GasFree 转账授权
 * 
 * 需要在 .env 中配置 PRIVATE_KEY
 */

import 'dotenv/config';
import crypto from 'crypto';
import TronWebModule from 'tronweb';
import gasFreeSDK from '@gasfree/gasfree-sdk';
import { apiRequest, CONFIG, CHAIN_ID, PRIVATE_KEY, log, formatUsdt } from './common.mjs';

const { TronGasFree } = gasFreeSDK;
const { TronWeb, utils: tronUtils } = TronWebModule;

// ==================== GasFree 签名 ====================

function getGasFreeTransactionJson(params) {
  const tronGasFree = new TronGasFree({ chainId: CHAIN_ID });
  return tronGasFree.assembleGasFreeTransactionJson({
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
}

function signGasFreeTransfer(privateKey, params) {
  const { domain, types, message } = getGasFreeTransactionJson(params);
  const signature = tronUtils.typedData.signTypedData(domain, types, message, privateKey);
  return {
    signature: signature.startsWith('0x') ? signature.slice(2) : signature,
  };
}

// ==================== 主函数 ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 4: POST /api/v1/gasfree/submit                       ║');
  console.log('║   提交 GasFree 转账授权                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // 检查私钥配置
  if (!PRIVATE_KEY) {
    log('请在 .env 文件中配置 PRIVATE_KEY', 'error');
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: CONFIG.tronApiUrl,
    privateKey: PRIVATE_KEY,
  });

  // 从命令行获取参数或使用默认值
  const userAddress = process.argv[2] || tronWeb.address.fromPrivateKey(PRIVATE_KEY);
  const receiverAddress = process.argv[3] || userAddress; // 默认转回自己
  const amount = parseInt(process.argv[4] || '1000000'); // 默认 1 USDT

  console.log(`\n转账参数:`);
  console.log(`    发送方 (user): ${userAddress}`);
  console.log(`    接收方 (receiver): ${receiverAddress}`);
  console.log(`    金额: ${formatUsdt(amount)} USDT`);

  // 1. 获取 Provider
  log('\n1. 获取 Provider...', 'wait');
  const providersResult = await apiRequest('GET', '/api/v1/config/provider/all');
  
  if (providersResult.data.code !== 200 || !providersResult.data.data.providers.length) {
    log('获取 Provider 失败', 'error');
    process.exit(1);
  }
  
  const provider = providersResult.data.data.providers[0];
  console.log(`\n选择 Provider: ${provider.name} (${provider.address})`);

  // 2. 获取账户信息 (获取 nonce)
  log('\n2. 获取账户信息...', 'wait');
  const accountResult = await apiRequest('GET', `/api/v1/address/${userAddress}`);
  
  if (accountResult.data.code !== 200) {
    log('获取账户信息失败', 'error');
    process.exit(1);
  }
  
  const accountData = accountResult.data.data;
  const nonce = accountData.nonce;
  const gasFreeAddress = accountData.gasFreeAddress;
  
  console.log(`\n账户信息:`);
  console.log(`    GasFree 地址: ${gasFreeAddress}`);
  console.log(`    Nonce: ${nonce}`);
  console.log(`    是否激活: ${accountData.active ? '是' : '否'}`);
  console.log(`    允许提交: ${accountData.allowSubmit ? '是' : '否'}`);

  if (!accountData.allowSubmit) {
    log('账户不允许提交转账，可能余额不足或有待处理的交易', 'error');
    if (accountData.assets && accountData.assets.length > 0) {
      console.log('当前资产:');
      accountData.assets.forEach(a => {
        console.log(`    ${a.tokenSymbol}: 可用=${formatUsdt(a.available)}, 冻结=${formatUsdt(a.frozen)}`);
      });
    }
    process.exit(1);
  }

  // 3. 获取手续费
  log('\n3. 获取手续费信息...', 'wait');
  const tokensResult = await apiRequest('GET', '/api/v1/config/token/all');
  
  let maxFee = 2000000; // 默认 2 USDT
  if (tokensResult.data.code === 200) {
    const usdtToken = tokensResult.data.data.tokens.find(t => t.tokenAddress === CONFIG.usdtAddress);
    if (usdtToken) {
      maxFee = usdtToken.transferFee;
      console.log(`\n手续费: ${formatUsdt(maxFee)} USDT`);
    }
  }

  // 4. 构造签名
  log('\n4. 构造签名...', 'wait');
  const deadline = Math.floor(Date.now() / 1000) + 180; // 3分钟后过期
  
  const transferParams = {
    token: CONFIG.usdtAddress,
    serviceProvider: provider.address,
    user: userAddress,
    receiver: receiverAddress,
    value: amount,
    maxFee: maxFee,
    deadline: deadline,
    nonce: nonce,
  };

  console.log(`\n签名参数:`);
  console.log(JSON.stringify(transferParams, null, 2));

  const { signature } = signGasFreeTransfer(PRIVATE_KEY, transferParams);
  console.log(`\n签名: ${signature.slice(0, 40)}...`);

  // 5. 提交转账
  log('\n5. 提交转账...', 'wait');
  const submitBody = {
    requestId: crypto.randomUUID(),
    token: CONFIG.usdtAddress,
    serviceProvider: provider.address,
    user: userAddress,
    receiver: receiverAddress,
    value: amount,
    maxFee: maxFee,
    deadline: deadline,
    version: 1,
    nonce: nonce,
    sig: signature,
  };

  const submitResult = await apiRequest('POST', '/api/v1/gasfree/submit', submitBody);
  
  console.log('\n' + '═'.repeat(60));
  
  if (submitResult.status === 200 && submitResult.data.code === 200) {
    log('提交成功!', 'success');
    const traceId = submitResult.data.data.id;
    console.log(`\ntraceId: ${traceId}`);
    console.log(`\n使用以下命令查询状态:`);
    console.log(`    node api-tests/5-get-status.mjs ${traceId}`);
  } else {
    log(`提交失败: ${submitResult.data.message || submitResult.data.reason || 'Unknown error'}`, 'error');
  }
}

main().catch(console.error);
