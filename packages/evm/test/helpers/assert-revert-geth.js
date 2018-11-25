const getAccounts = require('./get-accounts')
const { hexToAscii } = require('web3-utils')

module.exports = web3 => {
  const transactionWillRevert = (call) => {
    return new Promise(async (resolve, reject) => {
      if (!call.from) {
        const accounts = await getAccounts(web3)
        call.from = accounts[0]
      }

      web3.eth.estimateGas(call, (err) => {
        resolve(!!err)
      })
    })
  }

  return {
    assertRevert: async (call, reason) => {
      if (call.params) {
        call = call.params[0]
      }

      assert.isTrue(await transactionWillRevert(call), 'Transaction should revert')

      return new Promise((resolve, reject) => {
        web3.eth.call(call, (err, response) => {
          if (err) return reject(err)

          if (!reason) {
            return resolve()
          }

          // Poor man's error decoding
          // solidity error identifier -> bytes4(keccak256('Error(string)'))
          assert.equal(response.slice(0, 10), '0x08c379a0', 'Expected properly encoded error')
          let errorMessageHex = response
            .slice(74) // remove signature and position bytes
            .replace(/\b0+/g, '') // remove leading 0s
            .replace(/0+\b/g, '') // remove trailing 0s
            .slice(2) // remove length byte

          errorMessageHex =
            errorMessageHex.length % 2 == 0
            ? errorMessageHex
            : `${errorMessageHex}0` // add a trailing 0 in case we removed one extra (could be done with a smarter regex)

          const decodedError = hexToAscii('0x' + errorMessageHex)
          assert.equal(decodedError, reason, 'Revert reason should match')
          resolve()
        })
      })
    },

    assertSuccess: async (call) => {
      if (call.params) {
        call = call.params[0]
      }

      assert.isFalse(await transactionWillRevert(call), 'Transaction should not revert')
    }
  }
}
