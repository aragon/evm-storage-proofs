const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const StorageOracle = artifacts.require('StorageOracle')

contract('Storage Oracle', (accounts) => {
  let storageOracle

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

      await assertRevert(() =>
        storageOracle.getStateRoot(modifiedHeader, hash)
      )
    })

    it('reverts if header is too small', async () => {
      const { headerRLP, hash } = require('./data/block-3723000')
      const truncatedHeader = headerRLP.slice(0, 244) // too short

      await assertRevert(() =>
        storageOracle.getStateRoot(truncatedHeader, hash)
      )
    })
  })
})
