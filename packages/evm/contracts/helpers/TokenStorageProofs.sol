pragma solidity ^0.4.24;

import "../StorageOracle.sol";


contract TokenStorageProofs {
    enum TokenType {
        VanillaERC20,
        MiniMe
    }

    // should be deployed at a deterministic address
    StorageOracle public storageOracle; // unsure on the value of composition vs inheritance here

    constructor() public {
        storageOracle = new StorageOracle();
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
            // decode proofs (needs 2)
            // proof to checkpoints length
            // proof to balance
            // balance (uint128)
        }
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
            // decode proofs (needs 2)
            // proof to checkpoints length
            // proof to total supply
            // total supply (uint128)
        }
    }

    function getVanillaERC20BalanceSlot(address holder, uint256 balanceMappingPosition) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(holder), balanceMappingPosition));
    }
}