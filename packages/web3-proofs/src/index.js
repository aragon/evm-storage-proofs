const Web3 = require('web3')

class Web3Proofs {
  constructor (provider) {
    this.web3 = new Web3(provider)
  }

  async getProof (account, storageKeys = [], blockNumber = 'latest') {
    const proof = await this._jsonRpcSend('eth_getProof', [account, storageKeys, blockNumber])
    const block = await this.web3.eth.getBlock(blockNumber)

    return {
      proof,
      block
    }
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
