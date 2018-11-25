pragma solidity ^0.4.24;

import "./TrieProofs.sol";


contract StorageOracle {
    using TrieProofs for bytes;
    using RLP for RLP.RLPItem;
    using RLP for bytes;

    uint8 private constant ACCOUNT_STORAGE_ROOT_INDEX = 2;

    string private constant ERROR_BLOCKHASH_NOT_AVAILABLE = "BLOCKHASH_NOT_AVAILABLE";
    string private constant ERROR_INVALID_BLOCK_HEADER = "INVALID_BLOCK_HEADER";
    string private constant ERROR_UNPROCESSED_STORAGE_ROOT = "UNPROCESSED_STORAGE_ROOT";

    // Proven storage root for account at block number
    mapping (address => mapping (uint256 => bytes32)) public storageRoot;

    event ProcessStorageRoot(address indexed account, uint256 blockNumber, bytes32 storageRoot);

    function processStorageRoot(
        address account,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof
    )
        public
    {
        bytes32 blockHash = blockhash(blockNumber);
        // Before Constantinople only the most recent 256 block hashes are available
        require(blockHash != bytes32(0), ERROR_BLOCKHASH_NOT_AVAILABLE);

        bytes32 stateRoot = getStateRoot(blockHeaderRLP, blockHash);
        // The path for an account in the state trie is the hash of its address
        bytes32 proofPath = keccak256(abi.encodePacked(account));

        // Get the account state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes memory accountRLP = accountStateProof.verify(stateRoot, proofPath); // reverts if proof is invalid
        // Extract the storage root from the account node and convert to bytes32
        bytes32 accountStorageRoot = bytes32(accountRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint());

        storageRoot[account][blockNumber] = accountStorageRoot; // Cache the storage root in storage as proccessing is expensive

        emit ProcessStorageRoot(account, blockNumber, accountStorageRoot);
    }

    // TODO: support exclusion proofs
    function getStorage(
        address account,
        uint256 blockNumber,
        uint256 slot,
        bytes memory storageProof
    )
        public /*view*/ // TODO: remove logs from TrieProofs
        returns (uint256)
    {
        bytes32 root = storageRoot[account][blockNumber];
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);

        // The path for a storage value is the hash of its slot
        bytes32 proofPath = keccak256(abi.encodePacked(slot));
        return storageProof.verify(root, proofPath).toRLPItem().toUint();
    }

    /**
    * @dev Extract state root from block header, verifying block hash
    */
    function getStateRoot(bytes memory blockHeaderRLP, bytes32 blockHash) public pure returns (bytes32 stateRoot) {
        require(blockHeaderRLP.length > 123, ERROR_INVALID_BLOCK_HEADER); // prevent from reading invalid memory
        require(keccak256(blockHeaderRLP) == blockHash, ERROR_INVALID_BLOCK_HEADER);
        // 0x7b = 0x20 (length) + 0x5b (position of state root in header, [91, 123])
        assembly { stateRoot := mload(add(blockHeaderRLP, 0x7b)) }
    }
}
