pragma solidity ^0.4.24;


contract StorageTester {
  uint256 public i = 100;
  mapping (address => uint256) public map;

  constructor() public {
    map[address(this)] = 100;
  }

  function bump() external {
    i += 1;
  }
}