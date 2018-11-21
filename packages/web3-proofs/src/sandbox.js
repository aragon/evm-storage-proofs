const Web3 = require('web3')
const Web3Proofs = require('./index')

const runLocal = async () => {
  const provider = new Web3.providers.WebsocketProvider('ws://localhost:8546')
  const proofs = new Web3Proofs(provider)
  const response = await proofs.getProof('0x830ad8ef8b5b1c7f22fde94ddb30a19b2c34c2c8')
  console.log(response)
}

const runMainnet = async () => {
  const provider = new Web3.providers.WebsocketProvider('wss://mainnet.eth.aragon.network/ws')
  const proofs = new Web3Proofs(provider)
  const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0'
  const storageSlots = ['2'] // decimals slot
  const blockNumber = '3723000'
  const {
    proof,
    block,
    blockHeaderRLP
  } = await proofs.getProof(ANT, storageSlots, blockNumber)
  // console.log(response.proof.storageProof[0])
  // console.log(proofs.web3.utils.soliditySha3('2'))
  // last node in storage proof is [3 bytes 🤷‍ (rlp prefix??)][last 29 bytes of H('2')][value]

  console.log(blockHeaderRLP)
}

runMainnet()
