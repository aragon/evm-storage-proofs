const Web3Proofs = require('@aragon/web3-proofs')

const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const assertRevert = require('./helpers/assert-revert-geth')(web3)

const StorageOracle = artifacts.require('StorageOracle')
const TokenStorageProofs = artifacts.require('TokenStorageProofs')
const ERC20 = artifacts.require('SimpleERC20')


contract('Storage Oracle', (accounts) => {
  let storageOracle, tokenStorageProofs, web3proofs

  const TOKEN_TYPES = {
    vanilla: 0,
    minime: 1
  }

  before(async () => {
    web3proofs = new Web3Proofs()
  })

  beforeEach(async () => {
    tokenStorageProofs = await TokenStorageProofs.new()
    storageOracle = StorageOracle.at(await tokenStorageProofs.storageOracle())
  })

  context('vanilla ERC20', () => {
    let token, blockNumber

    const [holder, otherHolder] = accounts

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
})
