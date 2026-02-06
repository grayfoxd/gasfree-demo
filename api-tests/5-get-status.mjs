/**
 * API 测试 5: GET /api/v1/gasfree/{traceId}
 * 查询 GasFree 转账状态
 * 
 * 用法: node 5-get-status.mjs <traceId>
 * 示例: node 5-get-status.mjs 6ab4c27c-f66b-4328-b40f-ffdc6cf1ca60
 */

import { apiRequest, formatUsdt, log } from './common.mjs';

// 状态码映射 (API 返回字符串状态)
const STATE_DESC = {
  'WAITING': '待处理',
  'INPROGRESS': '处理中',
  'SUCCEED': '成功',
  'FAILED': '失败',
  'EXPIRED': '已过期',
  'CANCELED': '已取消',
};

const SUCCESS_STATES = ['SUCCEED', 'SUCCESS'];
const FAILED_STATES = ['FAILED', 'EXPIRED', 'CANCELED'];

async function main() {
  const traceId = process.argv[2];
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   API 测试 5: GET /api/v1/gasfree/{traceId}                     ║');
  console.log('║   查询 GasFree 转账状态                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  if (!traceId) {
    log('请提供 traceId 参数', 'error');
    console.log('\n用法: node 5-get-status.mjs <traceId>');
    console.log('示例: node 5-get-status.mjs 6ab4c27c-f66b-4328-b40f-ffdc6cf1ca60');
    process.exit(1);
  }

  console.log(`\n查询 traceId: ${traceId}`);

  const result = await apiRequest('GET', `/api/v1/gasfree/${traceId}`);
  
  console.log('\n' + '═'.repeat(60));
  
  if (result.status === 200 && result.data.code === 200) {
    const data = result.data.data;
    
    if (data) {
      log('查询成功!', 'success');
      
      console.log('\n转账详情:');
      console.log(`    traceId: ${data.id}`);
      console.log(`    状态: ${data.state} (${STATE_DESC[data.state] || data.state})`);
      console.log(`    发送方: ${data.accountAddress}`);
      console.log(`    接收方: ${data.targetAddress}`);
      console.log(`    金额: ${formatUsdt(data.txnAmount || data.amount)} USDT`);
      console.log(`    Nonce: ${data.nonce}`);
      console.log(`    创建时间: ${new Date(data.createdAt).toLocaleString()}`);
      
      if (data.txnActivateFee) {
        console.log(`    激活费: ${formatUsdt(data.txnActivateFee)} USDT`);
      }
      if (data.txnTransferFee) {
        console.log(`    转账费: ${formatUsdt(data.txnTransferFee)} USDT`);
      }
      if (data.txnTotalFee) {
        console.log(`    总费用: ${formatUsdt(data.txnTotalFee)} USDT`);
      }
      
      if (data.txnHash) {
        console.log(`    交易哈希: ${data.txnHash}`);
        console.log(`    Nile 浏览器: https://nile.tronscan.org/#/transaction/${data.txnHash}`);
      }
      
      if (SUCCESS_STATES.includes(data.state)) {
        log('\n🎉 转账已成功完成!', 'success');
      } else if (FAILED_STATES.includes(data.state)) {
        log('\n转账未成功', 'error');
      } else {
        log('\n转账处理中，请稍后再查询', 'wait');
      }
    } else {
      log('转账记录不存在', 'error');
    }
  } else {
    log(`查询失败: ${result.data.message || result.data.reason || 'Unknown error'}`, 'error');
  }
}

main().catch(console.error);
