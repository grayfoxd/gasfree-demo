/**
 * GasFree Demo - 完整示例
 * 
 * 功能包含:
 * 1. 账户创建 (EOA 账户和 GasFree 账户)
 * 2. API 鉴权
 * 3. API 调用 (获取 token 列表、provider 列表、账户信息、提交转账、查询状态)
 * 4. 转账签名 (EIP712 签名)
 * 
 * 使用方法:
 * 1. 安装依赖: npm install
 * 2. 配置 API_KEY 和 API_SECRET (可选，用于 API 调用)
 * 3. 运行: npm run demo 或 node gasfree-demo.mjs
 * 
 * 参考文档: https://gasfree.io/specification-cn?lang=zh-CN
 */

import crypto from 'crypto';
import TronWebModule from 'tronweb';

// TronWeb v6 导出方式
const { TronWeb, utils: tronUtils } = TronWebModule;

// ==================== 配置区域 ====================

// GasFree API 配置 (请替换为你自己的 API Key 和 Secret)
// 申请地址: https://gasfree.io 开发者中心
const API_KEY = 'YOUR_API_KEY';
const API_SECRET = 'YOUR_API_SECRET';

// 网络配置: 'nile' 测试网 或 'tron' 主网
const NETWORK = 'nile';

// 网络参数配置
const NETWORK_CONFIG = {
  nile: {
    chainId: 3448148188, // 0xcd8690dc
    verifyingContract: 'THQGuFzL87ZqhxkgqYEryRAd7gqFqL5rdc',
    apiBaseUrl: 'https://open-test.gasfree.io',
    tronApiUrl: 'https://nile.trongrid.io',
    // Nile 测试网 USDT 地址
    usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    // GasFree 相关合约参数
    beacon: 'TLtCGmaxH3PbuaF6kbybwteZcHptEdgQGC',
    gasFreeController: 'THQGuFzL87ZqhxkgqYEryRAd7gqFqL5rdc',
    creationCode: '0x60a06040908082526103e5803803809161001982856101d6565b833981019082818303126101d2576100308161020d565b91602091828101519060018060401b0382116101d2570181601f820112156101d25780519061005e8261022a565b9261006b875194856101d6565b8284528483830101116101d25783905f5b8381106101be5750505f9183010152823b1561017a5780516100b3575b50506080525161013c90816102a982396080518160180152f35b8351635c60da1b60e01b81529082826004816001600160a01b0388165afa918215610170575f9261012d575b50905f80838561011c9695519101845af4903d15610124573d6101018161022a565b9061010e885192836101d6565b81525f81943d92013e610245565b505f80610099565b60609250610245565b90918382813d8311610169575b61014481836101d6565b810103126101665750905f8061015d61011c959461020d565b939450506100df565b80fd5b503d61013a565b85513d5f823e3d90fd5b835162461bcd60e51b815260048101839052601b60248201527f626561636f6e2073686f756c64206265206120636f6e747261637400000000006044820152606490fd5b81810183015185820184015285920161007c565b5f80fd5b601f909101601f19168101906001600160401b038211908210176101f957604052565b634e487b7160e01b5f52604160045260245ffd5b516001600160a81b03811681036101d2576001600160a01b031690565b6001600160401b0381116101f957601f01601f191660200190565b9061026c575080511561025a57805190602001fd5b604051630a12f52160e11b8152600490fd5b8151158061029f575b61027d575090565b604051639996b31560e01b81526001600160a01b039091166004820152602490fd5b50803b1561027556fe60806040819052635c60da1b60e01b81526020816004817f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165afa9081156100ae575f91610056575f6100e8565b6020903d82116100a6575b601f8201601f1916810167ffffffffffffffff8111828210176100925761008c9350604052016100b9565b5f610050565b634e487b7160e01b84526041600452602484fd5b3d9150610061565b6040513d5f823e3d90fd5b602090607f1901126100e4576080516001600160a81b03811681036100e4576001600160a01b031690565b5f80fd5b5f808092368280378136915af43d82803e15610102573d90f35b3d90fdfea26474726f6e5822122019fba3a984dfef08920adc4d0e531dbd369df1dec237bfb02ce668f5d8e2704064736f6c63430008140033',
  },
  tron: {
    chainId: 728126428, // 0x2b6653dc
    verifyingContract: 'TFFAMLQZybALab4uxHA9RBE7pxhUAjfF3U',
    apiBaseUrl: 'https://open.gasfree.io',
    tronApiUrl: 'https://api.trongrid.io',
    // 主网 USDT 地址
    usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    // GasFree 相关合约参数
    beacon: 'TSP9UW6FQhT76XD2jWA6ipGMx3yGbjDffP',
    gasFreeController: 'TFFAMQLZybALaLb4uxHA9RBE7pxhUAjF3U',
    creationCode: '0x60a06040908082526103e5803803809161001982856101d6565b833981019082818303126101d2576100308161020d565b91602091828101519060018060401b0382116101d2570181601f820112156101d25780519061005e8261022a565b9261006b875194856101d6565b8284528483830101116101d25783905f5b8381106101be5750505f9183010152823b1561017a5780516100b3575b50506080525161013c90816102a982396080518160180152f35b8351635c60da1b60e01b81529082826004816001600160a01b0388165afa918215610170575f9261012d575b50905f80838561011c9695519101845af4903d15610124573d6101018161022a565b9061010e885192836101d6565b81525f81943d92013e610245565b505f80610099565b60609250610245565b90918382813d8311610169575b61014481836101d6565b810103126101665750905f8061015d61011c959461020d565b939450506100df565b80fd5b503d61013a565b85513d5f823e3d90fd5b835162461bcd60e51b815260048101839052601b60248201527f626561636f6e2073686f756c64206265206120636f6e747261637400000000006044820152606490fd5b81810183015185820184015285920161007c565b5f80fd5b601f909101601f19168101906001600160401b038211908210176101f957604052565b634e487b7160e01b5f52604160045260245ffd5b516001600160a81b03811681036101d2576001600160a01b031690565b6001600160401b0381116101f957601f01601f191660200190565b9061026c575080511561025a57805190602001fd5b604051630a12f52160e11b8152600490fd5b8151158061029f575b61027d575090565b604051639996b31560e01b81526001600160a01b039091166004820152602490fd5b50803b1561027556fe60806040819052635c60da1b60e01b81526020816004817f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165afa9081156100ae575f91610056575f6100e8565b6020903d82116100a6575b601f8201601f1916810167ffffffffffffffff8111828210176100925761008c9350604052016100b9565b5f610050565b634e487b7160e01b84526041600452602484fd5b3d9150610061565b6040513d5f823e3d90fd5b602090607f1901126100e4576080516001600160a81b03811681036100e4576001600160a01b031690565b5f80fd5b5f808092368280378136915af43d82803e15610102573d90f35b3d90fdfea26474726f6e58221220309a2919b7a1b203f1a7a1c544a7d671bb94b0adf8a39e4c9b6eeb6d03939ffe64736f6c63430008140033',
  },
};

// 获取当前网络配置
const config = NETWORK_CONFIG[NETWORK];

// 初始化 TronWeb 实例
const tronWeb = new TronWeb({
  fullHost: config.tronApiUrl,
});

// ==================== 工具函数 ====================

/**
 * Tron 地址转 Ethereum 格式地址 (0x 开头)
 * @param {string} tronAddress - TRON 格式地址 (T 开头)
 * @returns {string} Ethereum 格式地址 (0x 开头)
 */
function tronToEthAddress(tronAddress) {
  const hexAddress = tronWeb.address.toHex(tronAddress);
  return '0x' + hexAddress.slice(2);
}

/**
 * Ethereum 格式地址转 Tron 地址
 * @param {string} ethAddress - Ethereum 格式地址 (0x 开头)
 * @returns {string} TRON 格式地址 (T 开头)
 */
function ethToTronAddress(ethAddress) {
  return tronWeb.address.fromHex(ethAddress);
}

/**
 * 计算 keccak256 哈希
 * @param {Buffer|string} data - 待哈希的数据
 * @returns {string} 哈希结果 (0x 开头)
 */
function keccak256(data) {
  // TronWeb v6 使用 ethersUtils.keccak256
  if (typeof data === 'string' && !data.startsWith('0x')) {
    // 字符串转为 UTF8 bytes
    data = tronUtils.ethersUtils.toUtf8Bytes(data);
  } else if (Buffer.isBuffer(data)) {
    // Buffer 转为 hex 字符串
    data = '0x' + data.toString('hex');
  }
  return tronUtils.ethersUtils.keccak256(data);
}

// ==================== 1. 账户创建 ====================

/**
 * 创建新的 TRON 账户 (EOA)
 * @returns {Object} 包含地址、私钥等信息的账户对象
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
 * @param {string} privateKey - 私钥
 * @returns {Object} 账户信息
 */
function accountFromPrivateKey(privateKey) {
  const address = tronWeb.address.fromPrivateKey(privateKey);
  return {
    address: address,
    addressHex: tronWeb.address.toHex(address),
    privateKey: privateKey,
  };
}

/**
 * 计算 GasFree 账户地址
 * 根据 CREATE2 算法计算用户的 GasFree 地址
 * @param {string} userAddress - 用户的 EOA 地址 (TRON 格式)
 * @returns {string} GasFree 账户地址 (TRON 格式)
 */
function calculateGasFreeAddress(userAddress) {
  const userEthAddress = tronToEthAddress(userAddress);
  
  // 计算 salt = address padded to 32 bytes
  const salt = '0x' + userEthAddress.slice(2).toLowerCase().padStart(64, '0');
  
  // 计算 initializeData: initialize(address) selector + salt
  const functionSignature = 'initialize(address)';
  const funcSelector = keccak256(functionSignature).slice(0, 10);
  const initializeData = funcSelector + salt.slice(2);
  
  // beacon 地址转换
  const beaconHex = tronToEthAddress(config.beacon);
  
  // ABI encode (address beacon, bytes initializeData)
  const encodedParams = tronWeb.utils.abi.encodeParams(
    ['address', 'bytes'],
    [beaconHex, initializeData]
  );
  
  // 组合 creationCode + encodedParams
  const creationCodeHex = config.creationCode.startsWith('0x') 
    ? config.creationCode.slice(2) 
    : config.creationCode;
  const encodedParamsHex = encodedParams.startsWith('0x')
    ? encodedParams.slice(2)
    : encodedParams;
  
  const bytecodeHex = creationCodeHex + encodedParamsHex;
  const bytecodeHash = keccak256(Buffer.from(bytecodeHex, 'hex'));
  
  // 计算 CREATE2 地址
  // address = keccak256(0x41 + gasFreeController + salt + bytecodeHash)[12:]
  const gasFreeControllerHex = tronToEthAddress(config.gasFreeController);
  
  const create2Input = Buffer.concat([
    Buffer.from('41', 'hex'), // TRON 使用 0x41 前缀
    Buffer.from(gasFreeControllerHex.slice(2), 'hex'),
    Buffer.from(salt.slice(2), 'hex'),
    Buffer.from(bytecodeHash.slice(2), 'hex'),
  ]);
  
  const create2Hash = keccak256(create2Input);
  const ethGasFreeAddress = '0x' + create2Hash.slice(26);
  
  return ethToTronAddress(ethGasFreeAddress);
}

// ==================== 2. API 鉴权 ====================

/**
 * 生成 API 签名
 * 算法: HMAC-SHA256(method + path + timestamp, API_SECRET) -> base64
 * @param {string} method - HTTP 方法 (GET/POST)
 * @param {string} path - API 路径
 * @param {number} timestamp - 时间戳 (秒)
 * @returns {string} Base64 编码的签名
 */
function generateApiSignature(method, path, timestamp) {
  const message = `${method}${path}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(message)
    .digest('base64');
  return signature;
}

/**
 * 生成带鉴权的请求头
 * @param {string} method - HTTP 方法
 * @param {string} path - API 路径 (包含网络前缀，如 /nile/api/v1/...)
 * @returns {Object} 请求头对象
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

// ==================== 3. API 调用 ====================

/**
 * 通用 API 请求函数
 * @param {string} method - HTTP 方法
 * @param {string} apiPath - API 路径 (不含网络前缀)
 * @param {Object} body - 请求体 (可选)
 * @returns {Promise<Object>} API 响应
 */
async function apiRequest(method, apiPath, body = null) {
  // 构建完整路径 (用于签名)
  const fullPath = `/${NETWORK}${apiPath}`;
  const headers = getAuthHeaders(method, fullPath);
  const url = `${config.apiBaseUrl}${fullPath}`;
  
  const options = {
    method,
    headers,
  };
  
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

/**
 * 获取支持的 Token 列表
 * @returns {Promise<Object>} Token 列表
 */
async function getSupportedTokens() {
  return await apiRequest('GET', '/api/v1/config/token/all');
}

/**
 * 获取 Service Provider 列表
 * @returns {Promise<Object>} Provider 列表
 */
async function getProviders() {
  return await apiRequest('GET', '/api/v1/config/provider/all');
}

/**
 * 查询 GasFree 账户信息
 * @param {string} accountAddress - 用户 EOA 地址
 * @returns {Promise<Object>} 账户信息
 */
async function getGasFreeAccountInfo(accountAddress) {
  return await apiRequest('GET', `/api/v1/address/${accountAddress}`);
}

/**
 * 提交 GasFree 转账授权
 * @param {Object} transferParams - 转账参数
 * @returns {Promise<Object>} 提交结果
 */
async function submitGasFreeTransfer(transferParams) {
  return await apiRequest('POST', '/api/v1/gasfree/submit', transferParams);
}

/**
 * 查询 GasFree 转账状态
 * @param {string} traceId - 转账追踪 ID
 * @returns {Promise<Object>} 转账状态
 */
async function getTransferStatus(traceId) {
  return await apiRequest('GET', `/api/v1/gasfree/${traceId}`);
}

// ==================== 4. 转账签名 ====================

/**
 * EIP712 Domain 配置
 */
const Permit712MessageDomain = {
  name: 'GasFreeController',
  version: 'V1.0.0',
  chainId: config.chainId,
  verifyingContract: config.verifyingContract,
};

/**
 * EIP712 类型定义
 */
const Permit712MessageTypes = {
  PermitTransfer: [
    { name: 'token', type: 'address' },
    { name: 'serviceProvider', type: 'address' },
    { name: 'user', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'version', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

/**
 * 构造 GasFree 转账消息
 * @param {Object} params - 转账参数
 * @returns {Object} 转账消息
 */
function buildTransferMessage({
  token,
  serviceProvider,
  user,
  receiver,
  value,
  maxFee,
  deadline,
  nonce,
}) {
  return {
    token,
    serviceProvider,
    user,
    receiver,
    value: value.toString(),
    maxFee: maxFee.toString(),
    deadline: deadline.toString(),
    version: '1',
    nonce: nonce.toString(),
  };
}

/**
 * 使用私钥签名 EIP712 消息
 * @param {string} privateKey - 私钥
 * @param {Object} message - 转账消息
 * @returns {Promise<string>} 签名 (不含 0x 前缀)
 */
async function signTypedData(privateKey, message) {
  try {
    // TronWeb v6 使用 utils.typedData.signTypedData
    const signature = tronUtils.typedData.signTypedData(
      Permit712MessageDomain,
      Permit712MessageTypes,
      message,
      privateKey
    );
    // 去掉前缀 0x
    return signature.startsWith('0x') ? signature.slice(2) : signature;
  } catch (error) {
    console.error('TronWeb signTypedData 失败，尝试手动签名:', error.message);
    // 如果 signTypedData 不可用，使用手动计算方式
    return await manualSignTypedData(privateKey, message);
  }
}

/**
 * 编码 EIP712 类型字符串
 * @param {string} typeName - 类型名称
 * @returns {string} 编码后的类型字符串
 */
function encodeType(typeName) {
  const fields = Permit712MessageTypes[typeName];
  const fieldStrings = fields.map(f => `${f.type} ${f.name}`).join(',');
  return `${typeName}(${fieldStrings})`;
}

/**
 * 计算 EIP712 结构哈希
 * @param {string} typeName - 类型名称
 * @param {Object} data - 数据
 * @returns {string} 结构哈希
 */
function hashStruct(typeName, data) {
  const typeString = encodeType(typeName);
  const typeHash = keccak256(typeString);
  
  const types = Permit712MessageTypes[typeName] || [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ];
  
  let encodedData = typeHash.slice(2);
  
  for (const field of types) {
    const value = data[field.name];
    if (field.type === 'address') {
      // 地址需要转换为 eth 格式并补齐到 32 字节
      const ethAddr = tronWeb.isAddress(value) ? tronToEthAddress(value) : value;
      encodedData += ethAddr.slice(2).toLowerCase().padStart(64, '0');
    } else if (field.type === 'uint256') {
      encodedData += BigInt(value).toString(16).padStart(64, '0');
    } else if (field.type === 'string') {
      // 字符串先哈希
      encodedData += keccak256(value).slice(2);
    }
  }
  
  return keccak256(Buffer.from(encodedData, 'hex'));
}

/**
 * 计算 Domain Separator
 * @returns {string} Domain Separator 哈希
 */
function getDomainSeparator() {
  const typeString = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
  const typeHash = keccak256(typeString);
  
  const nameHash = keccak256(Permit712MessageDomain.name);
  const versionHash = keccak256(Permit712MessageDomain.version);
  const chainIdHex = BigInt(Permit712MessageDomain.chainId).toString(16).padStart(64, '0');
  const verifyingContractEth = tronToEthAddress(Permit712MessageDomain.verifyingContract);
  const verifyingContractHex = verifyingContractEth.slice(2).toLowerCase().padStart(64, '0');
  
  const encodedData = typeHash.slice(2) + nameHash.slice(2) + versionHash.slice(2) + chainIdHex + verifyingContractHex;
  
  return keccak256(Buffer.from(encodedData, 'hex'));
}

/**
 * 手动计算 EIP712 签名
 * @param {string} privateKey - 私钥
 * @param {Object} message - 转账消息
 * @returns {string} 签名
 */
async function manualSignTypedData(privateKey, message) {
  const domainSeparator = getDomainSeparator();
  const structHash = hashStruct('PermitTransfer', message);
  
  // 计算最终哈希: keccak256("\x19\x01" + domainSeparator + structHash)
  const combinedHex = '0x1901' + domainSeparator.slice(2) + structHash.slice(2);
  const messageHash = keccak256(Buffer.from(combinedHex.slice(2), 'hex'));
  
  // 使用 tronUtils.message.signMessage 签名消息哈希
  const signature = tronUtils.message.signMessage(messageHash, privateKey);
  
  return signature.startsWith('0x') ? signature.slice(2) : signature;
}

/**
 * 构造完整的 GasFree 转账请求
 * @param {Object} params - 转账参数
 * @returns {Promise<Object>} 完整的转账请求对象
 */
async function buildGasFreeTransferRequest({
  privateKey,
  tokenAddress,
  serviceProvider,
  receiverAddress,
  amount,
  maxFee,
  deadlineSeconds = 180,
}) {
  // 获取发送者地址
  const account = accountFromPrivateKey(privateKey);
  const userAddress = account.address;
  
  // 获取账户信息以获取 nonce
  const accountInfo = await getGasFreeAccountInfo(userAddress);
  if (accountInfo.code !== 200) {
    throw new Error(`获取账户信息失败: ${accountInfo.message || accountInfo.reason}`);
  }
  
  const nonce = accountInfo.data.nonce;
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;
  
  // 构造消息
  const message = buildTransferMessage({
    token: tokenAddress,
    serviceProvider,
    user: userAddress,
    receiver: receiverAddress,
    value: amount,
    maxFee,
    deadline,
    nonce,
  });
  
  console.log('转账消息:', JSON.stringify(message, null, 2));
  
  // 签名
  const signature = await signTypedData(privateKey, message);
  
  // 构造请求体
  return {
    requestId: crypto.randomUUID(),
    token: tokenAddress,
    serviceProvider,
    user: userAddress,
    receiver: receiverAddress,
    value: Number(amount),
    maxFee: Number(maxFee),
    deadline,
    version: 1,
    nonce,
    sig: signature,
  };
}

// ==================== 5. 完整流程示例 ====================

/**
 * 完整的 GasFree 转账流程示例
 */
async function gasFreeTransferDemo() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    GasFree Demo 开始                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`当前网络: ${NETWORK === 'nile' ? 'TRON Nile 测试网' : 'TRON 主网'}`);
  console.log(`API 基础地址: ${config.apiBaseUrl}`);
  console.log(`Chain ID: ${config.chainId}\n`);
  
  // ========== 1. 创建账户 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 1: 创建新账户 (EOA)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const newAccount = createAccount();
  console.log('✓ 新账户已创建');
  console.log(`  地址 (Base58): ${newAccount.address}`);
  console.log(`  地址 (Hex):    ${newAccount.addressHex}`);
  console.log(`  私钥:          ${newAccount.privateKey}`);
  
  // 计算 GasFree 地址
  try {
    const gasFreeAddress = calculateGasFreeAddress(newAccount.address);
    console.log(`  GasFree 地址:  ${gasFreeAddress}`);
  } catch (error) {
    console.log(`  GasFree 地址计算失败: ${error.message}`);
  }
  console.log();
  
  // ========== 2. 获取支持的 Token 列表 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 2: 获取支持的 Token 列表');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const tokensResult = await getSupportedTokens();
    if (tokensResult.code === 200) {
      console.log('✓ 支持的 Token 列表:');
      tokensResult.data.tokens.forEach(token => {
        const decimal = Math.pow(10, token.decimal);
        console.log(`  - ${token.symbol}`);
        console.log(`    地址: ${token.tokenAddress}`);
        console.log(`    激活费: ${token.activateFee / decimal} ${token.symbol}`);
        console.log(`    转账费: ${token.transferFee / decimal} ${token.symbol}`);
      });
    } else {
      console.log(`✗ 获取失败: ${tokensResult.message || tokensResult.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
    console.log('  提示: 请确保已配置正确的 API_KEY 和 API_SECRET');
  }
  console.log();
  
  // ========== 3. 获取 Provider 列表 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 3: 获取 Service Provider 列表');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let providerAddress = null;
  try {
    const providersResult = await getProviders();
    if (providersResult.code === 200) {
      console.log('✓ 可用的 Provider 列表:');
      providersResult.data.providers.forEach(provider => {
        providerAddress = provider.address;
        console.log(`  - ${provider.name}`);
        console.log(`    地址: ${provider.address}`);
        console.log(`    最大等待数: ${provider.config.maxPendingTransfer}`);
        console.log(`    Deadline 范围: ${provider.config.minDeadlineDuration}s - ${provider.config.maxDeadlineDuration}s`);
        console.log(`    推荐 Deadline: ${provider.config.defaultDeadlineDuration}s`);
      });
    } else {
      console.log(`✗ 获取失败: ${providersResult.message || providersResult.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  console.log();
  
  // ========== 4. 查询账户信息 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 4: 查询 GasFree 账户信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const accountInfo = await getGasFreeAccountInfo(newAccount.address);
    if (accountInfo.code === 200) {
      console.log('✓ 账户信息:');
      console.log(`  EOA 地址:      ${accountInfo.data.accountAddress}`);
      console.log(`  GasFree 地址:  ${accountInfo.data.gasFreeAddress}`);
      console.log(`  是否激活:      ${accountInfo.data.active ? '是' : '否'}`);
      console.log(`  当前 Nonce:    ${accountInfo.data.nonce}`);
      console.log(`  允许提交:      ${accountInfo.data.allowSubmit ? '是' : '否'}`);
      if (accountInfo.data.assets && accountInfo.data.assets.length > 0) {
        console.log('  资产:');
        accountInfo.data.assets.forEach(asset => {
          console.log(`    - ${asset.tokenSymbol}: frozen=${asset.frozen}`);
        });
      }
    } else {
      console.log(`✗ 查询失败: ${accountInfo.message || accountInfo.reason}`);
    }
  } catch (error) {
    console.log(`✗ API 调用失败: ${error.message}`);
  }
  console.log();
  
  // ========== 5. 构造转账签名示例 ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 5: 构造转账签名示例');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 使用示例 provider 地址 (如果 API 调用成功则使用实际地址)
  const exampleProvider = providerAddress || 'TQ6qStrS2ZJ96jcieJC8AutTxwqJEtmjfp';
  const exampleReceiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';
  
  const exampleMessage = buildTransferMessage({
    token: config.usdtAddress,
    serviceProvider: exampleProvider,
    user: newAccount.address,
    receiver: exampleReceiver,
    value: '90000000', // 90 USDT (最小单位)
    maxFee: '20000000', // 最大 20 USDT 手续费
    deadline: Math.floor(Date.now() / 1000) + 180, // 3分钟后过期
    nonce: 0,
  });
  
  console.log('✓ 转账消息:');
  console.log(JSON.stringify(exampleMessage, null, 2));
  
  try {
    const signature = await signTypedData(newAccount.privateKey, exampleMessage);
    console.log(`\n✓ 签名结果: ${signature}`);
    console.log(`  签名长度: ${signature.length} 字符`);
  } catch (error) {
    console.log(`\n✗ 签名失败: ${error.message}`);
  }
  console.log();
  
  // ========== 6. 完整转账流程示例 (不实际提交) ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 6: 完整转账请求构造示例');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('提示: 以下是完整的转账请求结构，可用于调用 POST /api/v1/gasfree/submit');
  
  const transferRequest = {
    requestId: crypto.randomUUID(),
    token: config.usdtAddress,
    serviceProvider: exampleProvider,
    user: newAccount.address,
    receiver: exampleReceiver,
    value: 90000000,
    maxFee: 20000000,
    deadline: Math.floor(Date.now() / 1000) + 180,
    version: 1,
    nonce: 0,
    sig: '<签名结果>',
  };
  
  console.log('\n转账请求体结构:');
  console.log(JSON.stringify(transferRequest, null, 2));
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    GasFree Demo 结束                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  console.log('\n提示:');
  console.log('1. 测试网水龙头: https://nileex.io/join/getJoinPage');
  console.log('2. 资产提取页面: https://test.gasfree.io/withdraw');
  console.log('3. 开发者文档: https://gasfree.io/specification-cn');
}

// ==================== 导出函数 ====================

export {
  // 账户相关
  createAccount,
  accountFromPrivateKey,
  calculateGasFreeAddress,
  
  // API 相关
  getSupportedTokens,
  getProviders,
  getGasFreeAccountInfo,
  submitGasFreeTransfer,
  getTransferStatus,
  
  // 签名相关
  buildTransferMessage,
  signTypedData,
  buildGasFreeTransferRequest,
  
  // 工具函数
  tronToEthAddress,
  ethToTronAddress,
  keccak256,
  generateApiSignature,
  getAuthHeaders,
  getDomainSeparator,
  hashStruct,
  
  // 配置
  NETWORK_CONFIG,
  Permit712MessageDomain,
  Permit712MessageTypes,
  
  // Demo 函数
  gasFreeTransferDemo,
};

// ==================== 运行 Demo ====================

// 如果直接运行此文件则执行 demo
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  gasFreeTransferDemo().catch(console.error);
}
