pragma solidity ^0.5.0;


contract StorageOracle {
  string private constant ERROR_BLOCKHASH_NOT_AVAILABLE = "BLOCKHASH_NOT_AVAILABLE";
  string private constant ERROR_INVALID_BLOCK_HEADER = "INVALID_BLOCK_HEADER";

  function processBlock(bytes memory blockHeaderRLP, uint256 blockNumber) public {
    bytes32 blockHash = blockhash(blockNumber);
    require(blockHash != bytes32(0), ERROR_BLOCKHASH_NOT_AVAILABLE);

    bytes32 stateRoot = getStateRoot(blockHeaderRLP, blockHash);
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
