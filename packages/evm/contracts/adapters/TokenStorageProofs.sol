pragma solidity ^0.4.24;

import "../StorageOracle.sol";


contract TokenStorageProofs {
    using RLP for RLP.RLPItem;
    using RLP for bytes;

    enum TokenType {
        VanillaERC20,
        MiniMe
    }

    string private constant ERROR_INVALID_MINIME_PROOF_LENGTH = "INVALID_MINIME_PROOF_LENGTH";

    // should be deployed at a deterministic address
    StorageOracle public storageOracle; // unsure on the value of composition vs inheritance here

    constructor(StorageOracle _storageOracle) public {
        storageOracle = _storageOracle;
    }

    function getBalance(
        address token,
        address holder,
        uint256 blockNumber,
        bytes memory proof,
        TokenType tokenType,
        uint256 basePosition
    )
        public view
        returns (uint256)
    {
        if (tokenType == TokenType.VanillaERC20) {
            uint256 slot = uint256(getVanillaERC20BalanceSlot(holder, basePosition));
            return storageOracle.getStorage(token, blockNumber, slot, proof);
        }

        if (tokenType == TokenType.MiniMe) {
            uint256 baseSlot = uint256(getMinimeCheckpointsLengthSlot(holder, basePosition));
            return getMiniMeCheckpointValue(token, blockNumber, baseSlot, proof);
        }

        return 0;
    }

    function getTotalSupply(
        address token,
        uint256 blockNumber,
        bytes memory proof,
        TokenType tokenType,
        uint256 basePosition
    )
        public view
        returns (uint256)
    {
        if (tokenType == TokenType.VanillaERC20) {
            return storageOracle.getStorage(token, blockNumber, basePosition, proof);
        }

        if (tokenType == TokenType.MiniMe) {
            return getMiniMeCheckpointValue(token, blockNumber, basePosition, proof);
        }
    }

    function getVanillaERC20BalanceSlot(address holder, uint256 balanceMappingPosition) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(holder), balanceMappingPosition));
    }

    function getMinimeCheckpointsLengthSlot(address holder, uint256 balanceMappingPosition) public pure returns (bytes32) {
        // array length is stored in the mapping value
        return keccak256(abi.encodePacked(bytes32(holder), balanceMappingPosition));
    }

    function getMinimeCheckpointSlot(uint256 checkpointsLength, uint256 baseSlot) public pure returns (bytes32) {
        // array members are stored at `index + keccak(p)`
        return bytes32(checkpointsLength - 1 + uint256(keccak256(abi.encodePacked(baseSlot))));
    }

    function getMiniMeCheckpointValue(
        address token,
        uint256 blockNumber,
        uint256 baseSlot,
        bytes memory proof
    )
        internal view
        returns (uint256)
    {
        // proof is an RLP encoded array with 2 proofs (first one to checkpoint length, second one to the actual balance)
        RLP.RLPItem[] memory proofs = proof.toRLPItem().toList();

        uint256 checkpointsLength = storageOracle.getStorage(token, blockNumber, baseSlot, proofs[0].toBytes());
        if (checkpointsLength == 0) {
            require(proofs.length == 1, ERROR_INVALID_MINIME_PROOF_LENGTH);
            return 0;
        }
        require(proofs.length == 2, ERROR_INVALID_MINIME_PROOF_LENGTH);
        uint256 checkpointSlot = uint256(getMinimeCheckpointSlot(checkpointsLength, baseSlot));
        // struct Checkpoint { uint128 fromBlock; uint128 value; }
        uint256 checkpoint = storageOracle.getStorage(token, blockNumber, checkpointSlot, proofs[1].toBytes());
        // value is stored as the most significant bits in a Checkpoint
        return checkpoint >> 128; // shift it 128 bits to the right
    }
}