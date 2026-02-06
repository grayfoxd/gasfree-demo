/**
 * API 测试 1: GET /api/v1/config/token/all
 * 获取支持的 Token 列表
 */

import { apiRequest, formatUsdt, log } from './common.mjs';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 1: GET /api/v1/config/token/all                      ║');
  console.log('║   获取支持的 Token 列表                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const result = await apiRequest('GET', '/api/v1/config/token/all');
  
  console.log('\n' + '═'.repeat(60));
  
  if (result.status === 200 && result.data.code === 200) {
    log('请求成功!', 'success');
    
    const tokens = result.data.data.tokens;
    console.log(`\n共 ${tokens.length} 个支持的 Token:\n`);
    
    tokens.forEach((token, index) => {
      const decimal = Math.pow(10, token.decimal);
      console.log(`[${index + 1}] ${token.symbol}`);
      console.log(`    地址: ${token.tokenAddress}`);
      console.log(`    精度: ${token.decimal}`);
      console.log(`    激活费: ${token.activateFee / decimal} ${token.symbol}`);
      console.log(`    转账费: ${token.transferFee / decimal} ${token.symbol}`);
      if (token.minTransfer !== undefined) {
        console.log(`    最小转账: ${token.minTransfer / decimal} ${token.symbol}`);
      }
      if (token.maxTransfer !== undefined) {
        console.log(`    最大转账: ${token.maxTransfer / decimal} ${token.symbol}`);
      }
      console.log();
    });
  } else {
    log(`请求失败: ${result.data.message || result.data.reason || 'Unknown error'}`, 'error');
  }
}

main().catch(console.error);
