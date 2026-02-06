/**
 * API 测试 6: 账户激活流程
 * 
 * 完整流程:
 * 1. 查询账户信息，检查是否已激活
 * 2. 如果未激活，EOA 向 GasFree 地址转入 USDT (普通 TRC20 转账)
 * 3. 通过 submit 接口提交转账，触发账户激活
 * 4. 查询激活结果
 * 
 * 用法: node 6-activate-account.mjs [EOA地址]
 * 默认使用 .env 中 PRIVATE_KEY 对应的地址
 */

import 'dotenv/config';
import crypto from 'crypto';
import TronWebModule from 'tronweb';
import gasFreeSDK from '@gasfree/gasfree-sdk';
import { apiRequest, CONFIG, CHAIN_ID, PRIVATE_KEY, log, formatUsdt } from './common.mjs';

const { TronGasFree } = gasFreeSDK;
const { TronWeb, utils: tronUtils } = TronWebModule;

// ==================== 配置 ====================

// 激活需要的 USDT 数量 (激活费2 + 转账费0.05 + 转账金额0.5 = 2.55, 留点余量)
const ACTIVATE_AMOUNT = 3000000; // 3 USDT
const TRANSFER_AMOUNT = 500000;  // 0.5 USDT 实际转账金额

// ==================== TRC20 转账 ====================

async function getUsdtBalance(tronWeb, address) {
  try {
    const contract = await tronWeb.contract().at(CONFIG.usdtAddress);
    const balance = await contract.balanceOf(address).call();
    return BigInt(balance.toString());
  } catch (error) {
    return 0n;
  }
}

async function transferUsdt(tronWeb, toAddress, amount) {
  const contract = await tronWeb.contract().at(CONFIG.usdtAddress);
  const tx = await contract.transfer(toAddress, amount).send();
  return tx;
}

async function waitForTransaction(tronWeb, txId, maxAttempts = 30) {
  log(`等待交易确认: ${txId}`, 'wait');
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info && info.id) {
        if (info.receipt && info.receipt.result === 'SUCCESS') {
          return { success: true, info };
        } else if (info.receipt) {
          return { success: false, info, error: 'Transaction failed' };
        }
      }
    } catch (e) {
      // 继续等待
    }
    process.stdout.write('.');
  }
  console.log();
  return { success: false, error: 'Timeout' };
}

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

// ==================== 主流程 ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 6: 账户激活流程                                       ║');
  console.log('║   EOA 向 GasFree 地址转账 + Submit 激活                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // 检查私钥
  if (!PRIVATE_KEY) {
    log('请在 .env 文件中配置 PRIVATE_KEY', 'error');
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: CONFIG.tronApiUrl,
    privateKey: PRIVATE_KEY,
  });

  const eoaAddress = process.argv[2] || tronWeb.address.fromPrivateKey(PRIVATE_KEY);
  
  console.log(`\nEOA 地址: ${eoaAddress}`);

  // ========== Step 1: 查询账户信息 ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 1: 查询 GasFree 账户信息');
  console.log('━'.repeat(60));

  const accountResult = await apiRequest('GET', `/api/v1/address/${eoaAddress}`);
  
  if (accountResult.data.code !== 200) {
    log(`查询账户失败: ${accountResult.data.message || accountResult.data.reason}`, 'error');
    process.exit(1);
  }

  const accountData = accountResult.data.data;
  const gasFreeAddress = accountData.gasFreeAddress;
  
  console.log(`\n账户状态:`);
  console.log(`    EOA 地址:      ${accountData.accountAddress}`);
  console.log(`    GasFree 地址:  ${gasFreeAddress}`);
  console.log(`    是否已激活:    ${accountData.active ? '是 ✓' : '否 ✗'}`);
  console.log(`    当前 Nonce:    ${accountData.nonce}`);
  console.log(`    允许提交:      ${accountData.allowSubmit ? '是' : '否'}`);

  if (accountData.active) {
    log('\n账户已激活，无需重复激活!', 'success');
    process.exit(0);
  }

  // ========== Step 2: 检查/转入 USDT ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 2: 检查 GasFree 地址余额');
  console.log('━'.repeat(60));

  const gasFreeBalance = await getUsdtBalance(tronWeb, gasFreeAddress);
  console.log(`\nGasFree 地址余额: ${formatUsdt(Number(gasFreeBalance))} USDT`);
  
  if (gasFreeBalance < BigInt(ACTIVATE_AMOUNT)) {
    const needed = BigInt(ACTIVATE_AMOUNT) - gasFreeBalance;
    log(`余额不足，需要转入 ${formatUsdt(Number(needed))} USDT`, 'wait');
    
    // 检查 EOA 余额
    const eoaBalance = await getUsdtBalance(tronWeb, eoaAddress);
    console.log(`EOA 地址余额: ${formatUsdt(Number(eoaBalance))} USDT`);
    
    if (eoaBalance < needed) {
      log(`EOA 余额不足! 需要 ${formatUsdt(Number(needed))} USDT`, 'error');
      log('请先向 EOA 地址转入 USDT');
      process.exit(1);
    }

    // 执行 TRC20 转账
    console.log('\n' + '━'.repeat(60));
    log('Step 2.1: EOA 向 GasFree 地址转入 USDT');
    console.log('━'.repeat(60));
    
    log(`转账: ${eoaAddress} -> ${gasFreeAddress}`);
    log(`金额: ${formatUsdt(Number(needed))} USDT`);

    try {
      const txId = await transferUsdt(tronWeb, gasFreeAddress, needed.toString());
      log(`交易已发送: ${txId}`, 'success');
      
      const result = await waitForTransaction(tronWeb, txId);
      if (result.success) {
        log('TRC20 转账成功!', 'success');
      } else {
        log(`TRC20 转账失败: ${result.error}`, 'error');
        process.exit(1);
      }
    } catch (error) {
      log(`TRC20 转账失败: ${error.message}`, 'error');
      process.exit(1);
    }

    // 等待系统同步
    log('\n等待系统同步...', 'wait');
    await new Promise(r => setTimeout(r, 5000));
  } else {
    log('余额充足，跳过转账步骤', 'success');
  }

  // ========== Step 3: 获取 Provider ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 3: 获取 Provider 信息');
  console.log('━'.repeat(60));

  const providersResult = await apiRequest('GET', '/api/v1/config/provider/all');
  
  if (providersResult.data.code !== 200 || !providersResult.data.data.providers.length) {
    log('获取 Provider 失败', 'error');
    process.exit(1);
  }
  
  const provider = providersResult.data.data.providers[0];
  console.log(`\n使用 Provider: ${provider.name} (${provider.address})`);

  // ========== Step 4: 获取最新账户信息 ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 4: 获取最新账户信息');
  console.log('━'.repeat(60));

  const updatedAccountResult = await apiRequest('GET', `/api/v1/address/${eoaAddress}`);
  
  if (updatedAccountResult.data.code !== 200) {
    log('获取账户信息失败', 'error');
    process.exit(1);
  }

  const updatedAccountData = updatedAccountResult.data.data;
  const nonce = updatedAccountData.nonce;

  console.log(`\n更新后账户状态:`);
  console.log(`    是否已激活:    ${updatedAccountData.active ? '是 ✓' : '否 ✗'}`);
  console.log(`    当前 Nonce:    ${nonce}`);
  console.log(`    允许提交:      ${updatedAccountData.allowSubmit ? '是' : '否'}`);

  if (!updatedAccountData.allowSubmit) {
    log('账户当前不允许提交，请检查余额或等待处理中的交易完成', 'error');
    process.exit(1);
  }

  // ========== Step 5: 提交激活转账 ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 5: 提交 GasFree 转账 (触发激活)');
  console.log('━'.repeat(60));

  // 获取激活费和转账费
  const tokensResult = await apiRequest('GET', '/api/v1/config/token/all');
  let activateFee = 2000000; // 默认 2 USDT
  let transferFee = 50000;   // 默认 0.05 USDT
  
  if (tokensResult.data.code === 200) {
    const usdtToken = tokensResult.data.data.tokens.find(t => t.tokenAddress === CONFIG.usdtAddress);
    if (usdtToken) {
      activateFee = usdtToken.activateFee;
      transferFee = usdtToken.transferFee;
    }
  }
  
  // 首次转账的 maxFee = 激活费 + 转账费
  const maxFee = activateFee + transferFee;
  const deadline = Math.floor(Date.now() / 1000) + 180;

  console.log(`\n转账参数:`);
  console.log(`    发送方: ${eoaAddress}`);
  console.log(`    接收方: ${eoaAddress} (转回自己)`);
  console.log(`    金额: ${formatUsdt(TRANSFER_AMOUNT)} USDT`);
  console.log(`    最大手续费: ${formatUsdt(maxFee)} USDT (激活费${formatUsdt(activateFee)} + 转账费${formatUsdt(transferFee)})`);
  console.log(`    Nonce: ${nonce}`);

  // 签名
  log('\n签名中...', 'wait');
  const { signature } = signGasFreeTransfer(PRIVATE_KEY, {
    token: CONFIG.usdtAddress,
    serviceProvider: provider.address,
    user: eoaAddress,
    receiver: eoaAddress, // 转回自己
    value: TRANSFER_AMOUNT,
    maxFee: maxFee,
    deadline: deadline,
    nonce: nonce,
  });

  // 提交
  const submitBody = {
    requestId: crypto.randomUUID(),
    token: CONFIG.usdtAddress,
    serviceProvider: provider.address,
    user: eoaAddress,
    receiver: eoaAddress,
    value: TRANSFER_AMOUNT,
    maxFee: maxFee,
    deadline: deadline,
    version: 1,
    nonce: nonce,
    sig: signature,
  };

  log('提交转账...', 'wait');
  const submitResult = await apiRequest('POST', '/api/v1/gasfree/submit', submitBody);
  
  if (submitResult.data.code !== 200) {
    log(`提交失败: ${submitResult.data.message || submitResult.data.reason}`, 'error');
    process.exit(1);
  }

  const traceId = submitResult.data.data.id;
  log(`提交成功! traceId: ${traceId}`, 'success');

  // ========== Step 6: 轮询查询结果 ==========
  console.log('\n' + '━'.repeat(60));
  log('Step 6: 查询转账/激活结果');
  console.log('━'.repeat(60));

  // 状态可能是数字或字符串
  const SUCCESS_STATES = [3, 'SUCCEED', 'SUCCESS', 'succeeded'];
  const FAILED_STATES = [4, 5, 6, 'FAILED', 'EXPIRED', 'CANCELED', 'failed', 'expired', 'canceled'];

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000));
    
    const statusResult = await apiRequest('GET', `/api/v1/gasfree/${traceId}`);
    
    if (statusResult.data.code === 200 && statusResult.data.data) {
      const state = statusResult.data.data.state;
      console.log(`\n[${i + 1}/20] 状态: ${state}`);
      
      if (SUCCESS_STATES.includes(state)) {
        log('\n🎉 激活转账成功!', 'success');
        console.log(`    交易哈希: ${statusResult.data.data.txnHash}`);
        console.log(`    金额: ${formatUsdt(statusResult.data.data.txnAmount || statusResult.data.data.amount)} USDT`);
        console.log(`    激活费: ${formatUsdt(statusResult.data.data.txnActivateFee)} USDT`);
        console.log(`    转账费: ${formatUsdt(statusResult.data.data.txnTransferFee)} USDT`);
        console.log(`    总费用: ${formatUsdt(statusResult.data.data.txnTotalFee)} USDT`);
        
        // 查询最终账户状态
        const finalResult = await apiRequest('GET', `/api/v1/address/${eoaAddress}`);
        if (finalResult.data.code === 200) {
          console.log(`\n最终账户状态:`);
          console.log(`    是否已激活: ${finalResult.data.data.active ? '是 ✓' : '否 ✗'}`);
          console.log(`    Nonce: ${finalResult.data.data.nonce}`);
        }
        break;
      } else if (FAILED_STATES.includes(state)) {
        log(`\n转账失败! 状态: ${state}`, 'error');
        break;
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  log('激活流程完成');
}

main().catch(error => {
  console.error('\n❌ 执行失败:', error.message);
  process.exit(1);
});
