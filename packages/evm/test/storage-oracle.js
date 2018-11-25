const Web3Proofs = require('@aragon/web3-proofs')

const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const assertRevert = require('./helpers/assert-revert-geth')(web3)

const StorageOracle = artifacts.require('StorageOracle')
const StorageTester = artifacts.require('StorageTester')


contract('Storage Oracle', (accounts) => {
  let storageOracle, web3proofs

  const INVALID_BLOCK_HEADER_ERROR = 'INVALID_BLOCK_HEADER'

  before(async () => {
    web3proofs = new Web3Proofs()
  })

  beforeEach(async () => {
    storageOracle = await StorageOracle.new()
  })

  context('block header parsing', () => {
    it('gets state root from block header', async () => {
      const { headerRLP, stateRoot, hash } = require('./data/block-3723000')

      assert.equal(await storageOracle.getStateRoot(headerRLP, hash), stateRoot)
    })

    it('reverts if block hash is incorrect', async () => {
      const { headerRLP, hash } = require('./data/block-3723000')

      // replace the last byte of the header
      const modifiedHeader = headerRLP.slice(0, -2) + '60'

      await assertRevert(
        storageOracle.getStateRoot.request(modifiedHeader, hash),
        INVALID_BLOCK_HEADER_ERROR
      )
    })

    it('reverts if header is too small', async () => {
      const { headerRLP, hash } = require('./data/block-3723000')
      const truncatedHeader = headerRLP.slice(0, 244) // too short

      await assertRevert(
        storageOracle.getStateRoot.request(truncatedHeader, hash),
        INVALID_BLOCK_HEADER_ERROR
      )
    })
  })

  context('account proofs', () => {
    let storageTester, blockNumber, proof

    beforeEach(async () => {
      storageTester = await StorageTester.new()
      blockNumber = await getBlockNumber()

      proof = await web3proofs.getProof(storageTester.address, [], blockNumber, false)
    })

    it('proccesses valid proof', async () => {
      const { receipt } = await storageOracle.processStorageRoot(
        storageTester.address,
        blockNumber,
        proof.blockHeaderRLP,
        proof.accountProofRLP
      )

      console.log(receipt.gasUsed)

      assert.equal(await storageOracle.storageRoot(storageTester.address, blockNumber), proof.proof.storageHash)
    })
  })

  context('storage proofs', () => {
    let storageTester, blockNumber, proof, initialValue, mappingSlot

    const INT_SLOT = '0'

    beforeEach(async () => {
      storageTester = await StorageTester.new()
      mappingSlot = await storageTester.mapStorageSlot()
      blockNumber = await getBlockNumber()

      proof = await web3proofs.getProof(storageTester.address, [INT_SLOT, mappingSlot], blockNumber, false)

      initialValue = await storageTester.i()
      await storageTester.bump() // we bump on the next block

      await storageOracle.processStorageRoot(
        storageTester.address,
        blockNumber,
        proof.blockHeaderRLP,
        proof.accountProofRLP
      )
    })

    it('gets simple storage value from proof', async () => {
      const value = await storageOracle.getStorage.call(
        storageTester.address,
        blockNumber,
        INT_SLOT,
        proof.storageProofsRLP[0]
      )

      assert.equal(value.toNumber(), initialValue.toNumber())
    })

    it('gets mapping value from storage proof', async () => {
      const value = await storageOracle.getStorage.call(
        storageTester.address,
        blockNumber,
        mappingSlot,
        proof.storageProofsRLP[1]
      )

      assert.equal(value.toNumber(), await storageTester.map(storageTester.address))
    })
  })
})
