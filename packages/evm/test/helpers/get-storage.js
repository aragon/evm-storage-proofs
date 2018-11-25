module.exports = web3 => (
  (account, slot) => new Promise((resolve, reject) => (
    web3.eth.getStorageAt(account, slot, (err, value) => {
      if (err) return reject(err)
      return resolve(value)
    })
  ))
)