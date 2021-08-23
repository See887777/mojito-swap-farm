// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

contract MojitoFactoryMock {
    address public pair;

    function setPair(address _pair) public {
        pair = _pair;
    }

    function getPair(address tokenA, address tokenB) public view returns (address) {
        require(tokenA != address(0), "MojitoFactoryMock::getPair: zero address");
        require(tokenB != address(0), "MojitoFactoryMock::getPair: zero address");
        return pair;
    }
}