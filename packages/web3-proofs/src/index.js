const Web3 = require('web3')

module.exports = (provider) => ({
  getProof: (account, storageKeys = [], blockNumber = 'latest') => {
    const payload = {
      method: 'eth_getProof',
      params: [
        account,
        storageKeys,
        blockNumber
      ],
      jsonrpc: '2.0',
      id: +new Date(),
    }

    return provider.send(payload)
  }
})
