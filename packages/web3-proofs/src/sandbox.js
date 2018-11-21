const Web3 = require('web3')
const Web3Proofs = require('./index')

const provider = new Web3.providers.WebsocketProvider('ws://localhost:8546')
const proofs = new Web3Proofs(provider)

const run = async () => {
  const response = await proofs.getProof('0x830ad8ef8b5b1c7f22fde94ddb30a19b2c34c2c8')
  console.log(response)
}

run()
