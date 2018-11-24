pragma solidity ^0.4.24;

import "./RLP.sol";


library TrieProofs {
    using RLP for RLP.RLPItem;
    using RLP for bytes;

    bytes32 internal constant EMPTY_TRIE_ROOT_HASH = 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421;

    event Log(string a, uint256 lol);
    event Wants(bytes32 x, bytes32 y);

    function verify(
        bytes memory proofRLP,
        bytes32 rootHash,
        bytes32 path32
    ) internal returns (bytes memory value)
    {
        // TODO: Optimize by using word-size paths instead of byte arrays
        bytes memory path = new bytes(32);
        assembly { mstore(add(path, 0x20), path32) } // careful as path may need to be 64
        path = decodeNibbles(path, 0); // lol, so efficient

        RLP.RLPItem[] memory proof = proofRLP.toRLPItem().toList();

        uint8 nodeChildren;
        RLP.RLPItem memory children;

        uint256 pathOffset = 0; // Offset of the proof
        bytes32 nextHash; // Required hash for the next node

        if (proof.length == 0) {
            // Root hash of empty tx trie
            require(rootHash == EMPTY_TRIE_ROOT_HASH, "Bad empty proof");
            return new bytes(0);
        }

        for (uint256 i = 0; i < proof.length; i++) {
            // We use the fact that an rlp encoded list consists of some
            // encoding of its length plus the concatenation of its
            // *rlp-encoded* items.
            bytes memory rlpNode = proof[i].toRLPBytes(); // TODO: optimize by not encoding and decoding?

            if (i == 0) {
                require(rootHash == keccak256(rlpNode), "Bad first proof part");
            } else {
                /* DEBUG
                if (nextHash != keccak256(rlpNode)) {
                    emit Wants(keccak256(nextHash), keccak256(rlpNode));
                    return rlpNode;
                }
                */
                require(nextHash == keccak256(rlpNode), "Bad hash");
            }

            RLP.RLPItem[] memory node = proof[i].toList();

            // Extension or Leaf node
            if (node.length == 2) {
                /*
                // TODO: wtf is a divergent node
                // proof claims divergent extension or leaf
                if (proofIndexes[i] == 0xff) {
                    require(i >= proof.length - 1); // divergent node must come last in proof
                    require(prefixLength != nodePath.length); // node isn't divergent
                    require(pathOffset == path.length); // didn't consume entire path

                    return new bytes(0);
                }

                require(proofIndexes[i] == 1); // an extension/leaf node only has two fields.
                require(prefixLength == nodePath.length); // node is divergent
                */

                bytes memory nodePath = merklePatriciaCompactDecode(node[0].toBytes());
                pathOffset += sharedPrefixLength(pathOffset, path, nodePath);

                // last proof item
                if (i == proof.length - 1) {
                    require(pathOffset == path.length, "Unexpected end of proof (leaf)");
                    return node[1].toBytes(); // Data is the second item in a leaf node
                } else {
                    // not last proof item
                    nodeChildren = extractNibble(path32, pathOffset);
                    children = node[nodeChildren];
                    if (!children.isList()) {
                        nextHash = getNextHash(children);
                    } else {
                        nextHash = keccak256(children.toRLPBytes());
                    }
                }
            }

            // Branch node
            require(node.length == 17);

            if (i == proof.length - 1) {
                // Proof ends in a branch node, exclusion proof in most cases
                require(pathOffset + 1 == path.length);
                return node[16].toBytes();
            } else {
                require(pathOffset < path.length, "Continuing branch has depleted path");

                nodeChildren = extractNibble(path32, pathOffset);
                emit Log("Extracted", nodeChildren);
                children = node[nodeChildren];

                pathOffset += 1; // advance by one

                if (i != proof.length - 1) {
                    // not last level
                    if (!children.isList()) {
                        nextHash = getNextHash(children);
                    } else {
                        nextHash = keccak256(children.toRLPBytes());
                    }
                } else { // last proof part
                    // must have an empty hash, everything else is invalid
                    require(children.toBytes().length == 0, "Should be empty children");
                    require(pathOffset == path.length, "Unexpected end of proof (branch)");

                    return new bytes(0);
                }
            }
        }

        // We should never reach this point.
        assert(false);
    }

    function getNextHash(RLP.RLPItem memory node) internal pure returns (bytes32 nextHash) {
        bytes memory nextHashBytes = node.toBytes();
        require(nextHashBytes.length == 32);

        assembly { nextHash := mload(add(nextHashBytes, 0x20)) }
    }

    /*
    * Nibble is extracted as the least significant nibble in the returned byte
    */
    function extractNibble(bytes32 path, uint256 position) internal pure returns (uint8 nibble) {
        require(position < 64);
        byte shifted = position == 0 ? byte(path >> 4) : byte(path << ((position - 1) * 4));
        return uint8(byte(shifted & 0xF));
    }

    function decodeNibbles(bytes memory compact, uint skipNibbles) internal pure returns (bytes memory nibbles) {
        require(compact.length > 0);

        uint length = compact.length * 2;
        require(skipNibbles <= length);
        length -= skipNibbles;

        nibbles = new bytes(length);
        uint nibblesLength = 0;

        for (uint i = skipNibbles; i < skipNibbles + length; i += 1) {
            if (i % 2 == 0) {
                nibbles[nibblesLength] = bytes1((uint8(compact[i/2]) >> 4) & 0xF);
            } else {
                nibbles[nibblesLength] = bytes1((uint8(compact[i/2]) >> 0) & 0xF);
            }
            nibblesLength += 1;
        }

        assert(nibblesLength == nibbles.length);
    }

    function merklePatriciaCompactDecode(bytes memory compact) internal pure returns (bytes memory nibbles) {
        require(compact.length > 0, "idiot length");
        uint first_nibble = uint8(compact[0]) >> 4 & 0xF;
        uint skipNibbles;
        if (first_nibble == 0) {
            skipNibbles = 2;
        } else if (first_nibble == 1) {
            skipNibbles = 1;
        } else if (first_nibble == 2) {
            skipNibbles = 2;
        } else if (first_nibble == 3) {
            skipNibbles = 1;
        } else {
            // Not supposed to happen!
            revert();
        }
        return decodeNibbles(compact, skipNibbles);
    }

    function sharedPrefixLength(uint xsOffset, bytes memory xs, bytes memory ys) internal pure returns (uint) {
        uint256 i = 0;
        for (i = 0; i + xsOffset < xs.length && i < ys.length; i++) {
            if (xs[i + xsOffset] != ys[i]) {
                return i;
            }
        }
        return i;
    }

    // TODO: wtf is hash hash needed?!!!!?!!?!?!
    function mptHashHash(bytes memory input) internal pure returns (bytes32) {
        if (input.length < 32) {
            return keccak256(input);
        } else {
            return keccak256(abi.encodePacked(keccak256(abi.encodePacked(input))));
        }
    }
}