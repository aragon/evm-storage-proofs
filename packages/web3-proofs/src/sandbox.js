const Web3 = require('web3')
const Web3Proofs = require('./index')

const runLocal = async () => {
  const provider = new Web3.providers.WebsocketProvider('ws://localhost:8546')
  const proofs = new Web3Proofs(provider)
  const { proof } = await proofs.getProof('0x70657e6c6B4b6920fbfc78E1A97002A85ce4e205')
  console.log(proof)
  console.log('successfully generated and verified proofs')
}

const runMainnet = async () => {
  const provider = new Web3.providers.WebsocketProvider('wss://mainnet.eth.aragon.network/ws')
  const proofs = new Web3Proofs(provider)
  const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0'
  const storageSlots = ['2'] // decimals slot
  const blockNumber = 'latest'
  const {
    proof,
    block,
    blockHeaderRLP
  } = await proofs.getProof(ANT, storageSlots, blockNumber)
  console.log(proof)
  console.log('successfully generated and verified proofs')

  // console.log(proof.storageProof[0])
  // console.log(proofs.web3.utils.soliditySha3('2'))
  // last node in storage proof is [3 bytes 🤷‍ (rlp prefix??)][last 29 bytes of H('2')][value]
}

runMainnet()
