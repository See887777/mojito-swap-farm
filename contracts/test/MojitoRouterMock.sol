// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

interface ISwapMining {
    function swap(address account, address input, address output, uint256 amount) external returns (bool);
}

contract MojitoRouterMock {
    address public factory;
    address public swapMining;

    constructor( address _factory) public {
        factory = _factory;
    }

    function setSwapMining(address _swapMininng) public {
        swapMining = _swapMininng;
    }

    function swap(address account, address input, address output, uint256 amount) public returns (bool) {
        return ISwapMining(swapMining).swap(account, input, output, amount);
    }
}