const Web3 = require('web3')
const RLP = require('rlp')
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
  console.log('successfully generated and verified proofs')

  console.log(proof.accountProofRLP)
  console.log(block.stateRoot)

  //proof.storageProof[0].proof.forEach((part) => console.log(RLP.decode(part)))
  proof.storageProof[0].proof.forEach((part) => console.log(RLP.decode(part).length, RLP.decode(part).map(x => (x.toString('hex').length || 0) / 2)))

  // console.log(RLP.decode(proof.storageProof[0].proof[6]))
  // console.log(proof.storageHash)
  // console.log(RLP.encode(proof.storageProof[0].proof.map(x => RLP.decode(x))).toString('hex'))
  //console.log(RLP.encode(proof.storageProof[0].proof).toString('hex')) // .proof.map(x => RLP.decode(x))).toString('hex'))

  // console.log(RLP.encode(proof.storageProof[0].proof.map(x => RLP.decode(x))).toString('hex'))

  // console.log(RLP.decode(proof.storageProof[0].proof[5][0]))
  // console.log(proof.storageProof[0])
  // console.log(proofs.web3.utils.soliditySha3('2'))
  // last node in storage proof is [3 bytes 🤷‍ (rlp prefix??)][last 29 bytes of H('2')][value]
}

runMainnet()
