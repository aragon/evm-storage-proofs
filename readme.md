# EVM Storage Proofs [![Build Status](https://travis-ci.org/aragon/evm-storage-proofs.svg?branch=master)](https://travis-ci.org/aragon/evm-storage-proofs)
> aka the Ethereum Storage Time Machine 🧙‍♂️

EVM Storage Proofs allow to trustlessly prove a past storage value in a contract to other contracts.

## Packages
- [`@aragon/evm-storage-proofs`](./packages/evm): On-chain component for verifying storage proofs and tests.
- [`@aragon/web3-proofs`](./packages/web3-proofs): Off-chain JS library for generating and locally verifying proofs.

## Use cases
- Fetching a value at a past block number (i.e. `ANT balance of 0xcafe1a77e... at block 5,000,000`)
- Inspecting storage values that are not exposed through a contract's public API.
- Executing code in an EVM (or a different VM) on the EVM with real storage values.
- More fun things 🎉

## Supported clients
- Geth >= 1.8.18 (you can start geth on a Docker container by running `npm run start:geth` in the [`evm` package](./packages/evm))
- Parity very soon. [Pull request](https://github.com/paritytech/parity-ethereum/pull/9001) was merged but it is still unreleased.

## Installing
```.sh
git clone https://github.com/aragon/evm-storage-proofs.git
npm install
cd packages/evm
npm test
```

## Usage

The best way to learn how the library and the contracts are used is by checking the [test suite for `@aragon/evm-storage-proofs`](./packages/evm/test)

### Proof generation

The current implementation uses the `eth_getProof` RPC method ([EIP 1186](https://github.com/ethereum/EIPs/issues/1186)) to generate proofs.

For generating proofs using the JS library:

```.js
const Web3Proofs = require('@aragon/web3-proofs') // Not published to NPM yet, requires a local 'npm link'

const web3proofs = new Web3Proofs(web3.currentProvider) // Or a web3.js 1.0 compatible provider

const proof = await web3proofs.getProof(contractAddress, [slot1, slot2], blockNumber)
```

If running on a live network, proof generation requires an archive node (unless the proof is being generated for the `latest` block). Whether proofs can be generated using the Ethereum light client protocol ([LES `GetProofs`](https://wiki.parity.io/Light-Ethereum-Subprotocol-(LES)#on-demand-data-retrieval)) is currently being researched.

### On-chain proof verification

The [`StorageOracle`](./packages/evm/contracts/StorageOracle.sol) contract can be used to verify a storage proof. There are two phases for proof verification:

#### 1. Account proof verification

A block header contains the merkle root for the Ethereum state trie for that block. An account proof is a merkle proof of the state of an account, which verifies the fields of an account (`[nonce, balance, storageHash, codeHash]`) for that block height.

In order to perform this verification for an account, the `StorageOracle` must be provided with the block header blob, the block number and the merkle proof for the account.

The `StorageOracle` will verify that the hash of provided `blockHeaderRLP` is the valid `blockhash` of the block number. The `stateRoot` is then extracted from the block header and then the `accountStateProof` is verified using the `stateRoot` as its root.

If the proof is successfully verified, **the `storageHash` for the account at that `blockNumber` is cached in the `StorageOracle`**. The `storageHash` is the root of the storage merkle trie for the account.

```solidity
storageOracle.processStorageRoot(account, blockNumber, blockHeaderRLP, accountStateProof)
```

🚨 Before the Constantinople hard fork, this phase of the proof can only be done for block numbers no older than **256 blocks**. After 256 blocks, block hashes become unavailable to contracts, and the proof cannot be processed. After the Constantinople hard fork, some older block hashes will also be available [under certain conditions](http://swende.se/blog/Blockhash-Refactor.html). After the proof is processed in the contract, it can be used forever.

#### 2. Storage proofs

A storage proof is a proof for a storage slot's value in an account at a certain block height. Contracts can store data in any of the `2^256` storage slots available, but normally they are ordered (see [Solidity reference](https://solidity.readthedocs.io/en/v0.4.24/miscellaneous.html#layout-of-state-variables-in-storage) or [Jorge Izquierdo's Devcon3 talk](https://youtu.be/sJ7VECqHFAg?t=568))

After having the `storageHash` verified and cached in the `StorageOracle`, merkle proofs in the account's storage trie can be verified. The `storageOracle#getStorage` function will verify the merkle proof and return the storage value. In case of an exclusion proof (proving that no value is stored in that slot), the function will return `uint256(0)`.

```solidity
uint256 value = storageOracle.getStorage(account, blockNumber, slot, storageProof)
```

Each storage slot contains a 32 byte value (`uint256` or `bytes32`), for more complex data structures multiple storage proofs can be done and the data structure can be composed.

✅ Even though the first step of the verification can only be done for recent blocks, once processed, storage proofs can be done at any time.

### Adapters: snapshotted token balances

The `StorageOracle` contract just implements the logic for trustlessly getting a past storage value on other contracts, but in order to get more interesting data, adapters can be built that use the `StorageOracle` for proving storage and give it extra meaning.

An example adapter has been built to prove historic token balances, [`TokenStorageProofs`](./packages/evm/contracts/adapters/TokenStorageProofs.sol), of tokens with two different internal data structures: a vanilla ERC20 token and a [MiniMeToken](https://github.com/Giveth/minime).

The [`TokenStorageProofs`](./packages/evm/contracts/adapters/TokenStorageProofs.sol) contract exposes two functions `getBalance` and `getTotalSupply`, which provided with the correct proof, will return the historic values from the token contract storage.

⚠️ The source code of the token contract must be inspected to calculate the base storage slot for the balances mapping and the storage slot for the total supply.

🚨 The token adapter **can only read raw storage values**. If a token executes arbitrary logic for returning balances or the supply, a custom adapter must be built. See for example how [MiniMe token balances are proven](./packages/evm/contracts/adapters/TokenStorageProofs.sol), which requires two merkle proofs because of how MiniMe stores data.

## Warnings

#### 🚨 Everything in this repo is highly experimental software.
It is not secure to use any of this code in production (mainnet) until proper security audits have been conducted.

#### 📉 Test coverage is low
There are a lot of edge cases that haven't been properly tested yet. Test contributions would be highly appreciated!

#### 🗃 Archive node required
Generating proofs for past block heights requires having access to an archive node. 

## Credits and resources
- [Lorenz Breidenbach](https://github.com/lorenzb): the Merkle proof verification code is heavily inspired from [Proveth](https://github.com/lorenzb/proveth)'s implementation.
- [Jordi Baylina](https://github.com/jbaylina): JS implementation of [merkle patricia trie proof verification](https://github.com/ethereumjs/merkle-patricia-tree/blob/master/src/proof.js)
- Ethereum wiki: [Patricia Tree spec](https://github.com/ethereum/wiki/wiki/Patricia-Tree)
- [Ethan Buchman](https://twitter.com/buchmanster): [Understanding the Ethereum trie](https://easythereentropy.wordpress.com/2014/06/04/understanding-the-ethereum-trie/)
- This amazing graph on how everything in Ethereum works:

![](https://i.stack.imgur.com/afWDt.jpg)
