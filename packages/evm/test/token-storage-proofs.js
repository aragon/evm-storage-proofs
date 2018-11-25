const Web3Proofs = require('@aragon/web3-proofs')
const RLP = require('rlp')

const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const { assertRevert, assertSuccess } = require('./helpers/assert-revert-geth')(web3)
const getStorage = require('./helpers/get-storage')(web3)

const StorageOracle = artifacts.require('StorageOracle')
const TokenStorageProofs = artifacts.require('TokenStorageProofs')
const ERC20 = artifacts.require('SimpleERC20')
const MiniMeToken = artifacts.require('MiniMeToken')


contract('Token Storage Proofs', (accounts) => {
  let storageOracle, tokenStorageProofs, web3proofs

  const [holder, otherHolder, noHolder] = accounts

  const TOKEN_TYPES = {
    vanilla: 0,
    minime: 1
  }

  before(async () => {
    web3proofs = new Web3Proofs()
  })

  beforeEach(async () => {
    storageOracle = await StorageOracle.new()
    tokenStorageProofs = await TokenStorageProofs.new(storageOracle.address)
  })

  context('vanilla ERC20', () => {
    let token, blockNumber

    const tokenType = TOKEN_TYPES['vanilla']
    const TOTAL_SUPPLY_SLOT = '0'
    const BALANCE_MAPPING_SLOT = '1'

    beforeEach(async () => {
      token = await ERC20.new() // first account gets 1 billion tokens
      await token.transfer(otherHolder, 1)

      blockNumber = await getBlockNumber()
      initialBalance = await token.balanceOf(holder)

      await token.transfer(otherHolder, 1)

      const proof = await web3proofs.getProof(token.address, [], blockNumber, false)

      await storageOracle.processStorageRoot(
        token.address,
        blockNumber,
        proof.blockHeaderRLP,
        proof.accountProofRLP
      )
    })

    it('gets balance from proof', async () => {
      const balanceSlot = await tokenStorageProofs.getVanillaERC20BalanceSlot(holder, BALANCE_MAPPING_SLOT)
      const { storageProofsRLP } = await web3proofs.getProof(token.address, [balanceSlot], blockNumber, false)

      const provenBalance = await tokenStorageProofs.getBalance(
        token.address,
        holder,
        blockNumber,
        storageProofsRLP[0],
        tokenType,
        BALANCE_MAPPING_SLOT
      )

      assert.equal(provenBalance.toNumber(), initialBalance.toNumber())
    })

    it('gets 0 balance for non-holder from exclusion proof', async () => {
      const balanceSlot = await tokenStorageProofs.getVanillaERC20BalanceSlot(noHolder, BALANCE_MAPPING_SLOT)
      const { storageProofsRLP, proof } = await web3proofs.getProof(token.address, [balanceSlot], blockNumber, false)

      const provenBalance = await tokenStorageProofs.getBalance(
        token.address,
        noHolder,
        blockNumber,
        storageProofsRLP[0],
        tokenType,
        BALANCE_MAPPING_SLOT
      )

      assert.equal(provenBalance.toNumber(), 0)

      // Ensure that the returned 0 is not from a revert with no error data
      await assertSuccess(tokenStorageProofs.getBalance.request(
        token.address,
        noHolder,
        blockNumber,
        storageProofsRLP[0],
        tokenType,
        BALANCE_MAPPING_SLOT
      ))
    })

    it('gets total supply from proof', async () => {
      const { storageProofsRLP } = await web3proofs.getProof(token.address, [TOTAL_SUPPLY_SLOT], blockNumber, false)

      const provenTotalSupply = await tokenStorageProofs.getTotalSupply(
        token.address,
        blockNumber,
        storageProofsRLP[0],
        tokenType,
        TOTAL_SUPPLY_SLOT
      )

      assert.equal(provenTotalSupply.toNumber(), await token.totalSupply())
    })
  })

  context('minime', () => {
    let token, blockNumber, checkpointLengthSlot, checkpointsLength

    const BALANCE_MAPPING_SLOT = '8'
    const TOTAL_SUPPLY_SLOT = '10'
    const tokenType = TOKEN_TYPES['minime']

    const encodeMultiproof = proofs => {
      const rlpArray = RLP.encode(proofs.map(proof => Buffer.from(proof.slice(2), 'hex')))
      return '0x' + rlpArray.toString('hex')
    }

    beforeEach(async () => {
      const NULL_ADDRESS = '0x00'
      token = await MiniMeToken.new(NULL_ADDRESS, NULL_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime
      await token.generateTokens(holder, 1e6)// first account gets 1 million tokens
      await token.transfer(otherHolder, 1)

      blockNumber = await getBlockNumber()
      initialBalance = await token.balanceOf(holder)
      checkpointLengthSlot = await tokenStorageProofs.getMinimeCheckpointsLengthSlot(holder, BALANCE_MAPPING_SLOT)
      checkpointsLength = web3.toBigNumber(await getStorage(token.address, checkpointLengthSlot))

      await token.transfer(otherHolder, 1)

      const proof = await web3proofs.getProof(token.address, [], blockNumber, false)

      await storageOracle.processStorageRoot(
        token.address,
        blockNumber,
        proof.blockHeaderRLP,
        proof.accountProofRLP
      )
    })

    it('gets balance from proof', async () => {
      const checkpointSlot = await tokenStorageProofs.getMinimeCheckpointSlot(checkpointsLength, checkpointLengthSlot)
      const { storageProofsRLP } = await web3proofs.getProof(token.address, [checkpointLengthSlot, checkpointSlot], blockNumber, false)

      const provenBalance = await tokenStorageProofs.getBalance(
        token.address,
        holder,
        blockNumber,
        encodeMultiproof(storageProofsRLP),
        tokenType,
        BALANCE_MAPPING_SLOT
      )

      assert.equal(provenBalance.toNumber(), initialBalance.toNumber())
    })

    it('gets 0 balance for non-holder from exclusion proof', async () => {
      const zeroLengthSlot = await tokenStorageProofs.getMinimeCheckpointsLengthSlot(noHolder, BALANCE_MAPPING_SLOT)
      const { storageProofsRLP } = await web3proofs.getProof(token.address, [zeroLengthSlot], blockNumber, false)

      const provenBalance = await tokenStorageProofs.getBalance(
        token.address,
        noHolder,
        blockNumber,
        encodeMultiproof(storageProofsRLP),
        tokenType,
        BALANCE_MAPPING_SLOT
      )

      assert.equal(provenBalance.toNumber(), 0)

      // Ensure that the returned 0 is not from a revert with no error data
      await assertSuccess(tokenStorageProofs.getBalance.request(
        token.address,
        noHolder,
        blockNumber,
        encodeMultiproof(storageProofsRLP),
        tokenType,
        BALANCE_MAPPING_SLOT
      ))
    })

    it('gets total supply from proof', async () => {
      // Assumes tokens are only generated before freezing the block number
      const supplyCheckpointsLength = web3.toBigNumber(await getStorage(token.address, TOTAL_SUPPLY_SLOT))
      const checkpointSlot = await tokenStorageProofs.getMinimeCheckpointSlot(supplyCheckpointsLength, TOTAL_SUPPLY_SLOT)
      const { storageProofsRLP } = await web3proofs.getProof(token.address, [web3.toHex(TOTAL_SUPPLY_SLOT), checkpointSlot], blockNumber, false)

      const provenSupply = await tokenStorageProofs.getTotalSupply(
        token.address,
        blockNumber,
        encodeMultiproof(storageProofsRLP),
        tokenType,
        TOTAL_SUPPLY_SLOT
      )

      assert.equal(provenSupply.toNumber(), await token.totalSupply())
    })
  })
})
