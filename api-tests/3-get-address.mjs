/**
 * API 测试 3: GET /api/v1/address/{accountAddress}
 * 查询 GasFree 账户信息
 * 
 * 用法: node 3-get-address.mjs [地址]
 * 示例: node 3-get-address.mjs TJM1BE5wq1VdHh3gwjUeyaVkvZp9DVYCfC
 */

import { apiRequest, formatUsdt, log } from './common.mjs';

async function main() {
  // 从命令行参数获取地址，或使用默认测试地址
  const address = process.argv[2] || 'TNrVLZTqJ14FoFxcPHAHNJTD7taZeMK1vT';
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 3: GET /api/v1/address/{accountAddress}              ║');
  console.log('║   查询 GasFree 账户信息                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  console.log(`\n查询地址: ${address}`);

  const result = await apiRequest('GET', `/api/v1/address/${address}`);
  
  console.log('\n' + '═'.repeat(60));
  
  if (result.status === 200 && result.data.code === 200) {
    log('请求成功!', 'success');
    
    const data = result.data.data;
    console.log('\nGasFree 账户信息:');
    console.log(`    EOA 地址:      ${data.accountAddress}`);
    console.log(`    GasFree 地址:  ${data.gasFreeAddress}`);
    console.log(`    是否激活:      ${data.active ? '是' : '否'}`);
    console.log(`    当前 Nonce:    ${data.nonce}`);
    console.log(`    允许提交:      ${data.allowSubmit ? '是' : '否'}`);
    
    if (data.assets && data.assets.length > 0) {
      console.log('\n    资产信息:');
      data.assets.forEach(asset => {
        console.log(`      - ${asset.tokenSymbol}:`);
        if (asset.available !== undefined) {
          console.log(`          可用: ${formatUsdt(asset.available)}`);
        }
        console.log(`          冻结: ${formatUsdt(asset.frozen || 0)}`);
        console.log(`          激活费: ${formatUsdt(asset.activateFee)}`);
        console.log(`          转账费: ${formatUsdt(asset.transferFee)}`);
      });
    } else {
      console.log('\n    资产信息: 无');
    }
  } else {
    log(`请求失败: ${result.data.message || result.data.reason || 'Unknown error'}`, 'error');
  }
}

main().catch(console.error);
