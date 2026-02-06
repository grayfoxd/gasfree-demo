# GasFree SDK Demo

GasFree 是一个让用户无需持有原生代币（TRX）即可进行 USDT 转账的服务。本项目提供了完整的 GasFree API 测试脚本和 SDK 使用示例。

## 业务流程

### 什么是 GasFree？

GasFree 通过 EIP712 签名授权的方式，让用户可以使用 USDT 支付手续费进行转账，而无需持有 TRX。

### 核心概念

| 概念 | 说明 |
|------|------|
| **EOA 账户** | 用户的普通 TRON 地址 |
| **GasFree 地址** | 由 EOA 地址通过 CREATE2 算法派生的合约地址，用于接收和存储 USDT |
| **激活费** | 首次使用 GasFree 时需支付的费用（当前 2 USDT） |
| **转账费** | 每次转账需支付的手续费（当前 0.05 USDT） |
| **Service Provider** | 代付 TRX Gas 费的服务商 |

### 完整业务流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      GasFree 转账流程                            │
└─────────────────────────────────────────────────────────────────┘

1. 获取 GasFree 地址
   ┌──────────┐    GET /api/v1/address/{eoa}    ┌──────────────┐
   │ EOA 账户  │ ─────────────────────────────▶ │ GasFree 地址  │
   └──────────┘                                  └──────────────┘

2. 充值 USDT (普通 TRC20 转账)
   ┌──────────┐    TRC20 Transfer    ┌──────────────┐
   │ 任意账户  │ ─────────────────▶  │ GasFree 地址  │
   └──────────┘                      └──────────────┘

3. 激活账户 (首次转账)
   ┌──────────┐    POST /api/v1/gasfree/submit    ┌──────────────┐
   │ EOA 签名  │ ─────────────────────────────▶   │ 账户已激活    │
   └──────────┘    maxFee = 激活费 + 转账费        └──────────────┘

4. 后续转账 (已激活)
   ┌──────────┐    POST /api/v1/gasfree/submit    ┌──────────────┐
   │ EOA 签名  │ ─────────────────────────────▶   │ 转账完成      │
   └──────────┘    maxFee = 转账费                └──────────────┘
```

## 环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 主账户私钥 (用于测试，需要有 USDT 余额)
PRIVATE_KEY=your_private_key_here

# GasFree API 配置 (Nile 测试网)
API_KEY=
API_SECRET=

# 可选：转账金额 (默认 5 USDT)
TRANSFER_AMOUNT=5
```

## 脚本使用

### 快速开始

```bash
# 运行 SDK 功能演示 (不需要私钥)
npm run demo

# 运行完整流程测试 (需要配置私钥)
npm run nile-test
```

### 脚本说明

| 脚本 | 说明 | 是否需要私钥 |
|------|------|-------------|
| `gasfree-sdk-demo.mjs` | SDK 功能演示，展示各 API 和签名方法 | 否 |
| `gasfree-sdk-nile-test.mjs` | 完整流程测试，包含激活和转账 | 是 |

### API 单独测试脚本

位于 `api-tests/` 目录下，可单独测试每个 API 接口：

```bash
# 1. 获取支持的 Token 列表
npm run api:tokens

# 2. 获取 Provider 列表
npm run api:providers

# 3. 查询 GasFree 账户信息
node api-tests/3-get-address.mjs <地址>

# 4. 提交 GasFree 转账
node api-tests/4-submit-transfer.mjs [user] [receiver] [金额]

# 5. 查询转账状态
node api-tests/5-get-status.mjs <traceId>

# 6. 完整激活流程
npm run api:activate
```

## API 接口

### 配置接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/config/token/all` | GET | 获取支持的 Token 列表 |
| `/api/v1/config/provider/all` | GET | 获取 Service Provider 列表 |

### 账户接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/address/{address}` | GET | 查询 GasFree 账户信息 |

### 转账接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/gasfree/submit` | POST | 提交 GasFree 转账授权 |
| `/api/v1/gasfree/{traceId}` | GET | 查询转账状态 |

## 签名说明

GasFree 使用 EIP712 标准进行签名，签名数据结构：

```javascript
{
  domain: {
    name: "GasFreeController",
    version: "V1.0.0",
    chainId: 3448148188,  // Nile 测试网
    verifyingContract: "THQGuFzL87ZqhxkgqYEryRAd7gqFqL5rdc"
  },
  types: {
    PermitTransfer: [
      { name: "token", type: "address" },
      { name: "serviceProvider", type: "address" },
      { name: "user", type: "address" },
      { name: "receiver", type: "address" },
      { name: "value", type: "uint256" },
      { name: "maxFee", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "version", type: "uint256" },
      { name: "nonce", type: "uint256" }
    ]
  },
  message: {
    token: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    serviceProvider: "TKtWbdzEq5ss9vTS9kwRhBp5mXmBfBns3E",
    user: "<EOA地址>",
    receiver: "<接收地址>",
    value: "1000000",      // 1 USDT
    maxFee: "2050000",     // 激活费+转账费 或 仅转账费
    deadline: "1770362990", // Unix 时间戳
    version: "1",
    nonce: "0"             // 当前 nonce
  }
}
```

## 费用说明

| 费用类型 | 金额 | 说明 |
|---------|------|------|
| 激活费 | 2 USDT | 首次转账时收取 |
| 转账费 | 0.05 USDT | 每次转账收取 |

**首次转账：** `maxFee = 激活费 + 转账费 = 2.05 USDT`

**后续转账：** `maxFee = 转账费 = 0.05 USDT`

## 状态码说明

| 状态 | 说明 |
|------|------|
| WAITING | 待处理 |
| INPROGRESS | 处理中 |
| SUCCEED | 成功 |
| FAILED | 失败 |
| EXPIRED | 已过期 |
| CANCELED | 已取消 |

## 相关链接

- [GasFree 官方文档](https://gasfree.io/specification-cn)
- [Nile 测试网水龙头](https://nileex.io/join/getJoinPage)
- [GasFree 资产提取](https://test.gasfree.io/withdraw)
- [Nile 区块浏览器](https://nile.tronscan.org/)

## 目录结构

```
gasfreedemo/
├── .env.example              # 环境变量模板
├── .env                      # 环境变量配置 (需自行创建)
├── package.json              # 项目配置
├── README.md                 # 本文件
├── gasfree-sdk-demo.mjs      # SDK 功能演示脚本
├── gasfree-sdk-nile-test.mjs # 完整流程测试脚本
└── api-tests/                # API 单独测试脚本
    ├── common.mjs            # 公共模块
    ├── 1-get-tokens.mjs      # Token 列表
    ├── 2-get-providers.mjs   # Provider 列表
    ├── 3-get-address.mjs     # 账户信息
    ├── 4-submit-transfer.mjs # 提交转账
    ├── 5-get-status.mjs      # 转账状态
    └── 6-activate-account.mjs # 激活账户
```

## License

MIT
