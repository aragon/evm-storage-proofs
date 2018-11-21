const Web3 = require('web3')
const EthereumBlock = require('ethereumjs-block/from-rpc')
const RLP = require('rlp')

class Web3Proofs {
  constructor (provider) {
    this.web3 = new Web3(provider)
  }

  async getProof (account, storageKeys = [], blockNumber = 'latest') {
    const proof = await this._jsonRpcSend('eth_getProof', [account, storageKeys, blockNumber])
    const block = await this.web3.eth.getBlock(blockNumber)
    const blockHeaderRLP = this._blockHeaderRLP(block)

    return {
      proof,
      block,
      blockHeaderRLP
    }
  }

  _blockHeaderRLP(block) {
    // From https://github.com/zmitton/eth-proof/blob/master/buildProof.js#L274
    block.difficulty = '0x' + this.web3.utils.toBN(block.difficulty).toString(16)
    const ethereumBlock = new EthereumBlock(block)
    const blockHeaderRLP = '0x' + RLP.encode(ethereumBlock.header.raw).toString('hex')

    const solidityBlockHash = this.web3.utils.soliditySha3(blockHeaderRLP)

    if (solidityBlockHash !== block.hash) {
      throw new Error(`Block header rlp hash (${solidityBlockHash}) doesnt match block hash (${block.hash})`)
    }

    return blockHeaderRLP
  }

  _jsonRpcSend(method, params) {
    const payload = {
      method,
      params,
      jsonrpc: '2.0',
      id: +new Date(),
    }

    return new Promise((resolve, reject) => {
      this.web3.currentProvider.send(payload, (err, response) => {
        if (err) reject(err)
        resolve(response.result)
      })
    })
  }
}

module.exports = Web3Proofs
