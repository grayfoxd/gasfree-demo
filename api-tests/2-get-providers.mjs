/**
 * API 测试 2: GET /api/v1/config/provider/all
 * 获取 Service Provider 列表
 */

import { apiRequest, log } from './common.mjs';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 2: GET /api/v1/config/provider/all                   ║');
  console.log('║   获取 Service Provider 列表                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const result = await apiRequest('GET', '/api/v1/config/provider/all');
  
  console.log('\n' + '═'.repeat(60));
  
  if (result.status === 200 && result.data.code === 200) {
    log('请求成功!', 'success');
    
    const providers = result.data.data.providers;
    console.log(`\n共 ${providers.length} 个 Provider:\n`);
    
    providers.forEach((provider, index) => {
      console.log(`[${index + 1}] ${provider.name}`);
      console.log(`    地址: ${provider.address}`);
      console.log(`    网站: ${provider.website || 'N/A'}`);
      console.log(`    配置:`);
      console.log(`      - minDeadlineDuration: ${provider.config.minDeadlineDuration}s`);
      console.log(`      - maxDeadlineDuration: ${provider.config.maxDeadlineDuration}s`);
      console.log(`      - defaultDeadlineDuration: ${provider.config.defaultDeadlineDuration}s`);
      console.log(`      - maxPendingTransfer: ${provider.config.maxPendingTransfer}`);
      console.log();
    });
  } else {
    log(`请求失败: ${result.data.message || result.data.reason || 'Unknown error'}`, 'error');
  }
}

main().catch(console.error);
