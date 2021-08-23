// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

contract MojitoOracleMock {
    uint256 public factor = 1;

    function setFactor(uint256 _factor) public {
        factor = _factor;
    }

    function consult(address tokenIn, uint amountIn, address tokenOut) public view returns (uint amountOut) {
        require(tokenIn != address(0), "MojitoOracleMock::consult: zero address");
        require(tokenOut != address(0), "MojitoOracleMock::consult: zero address");
        return amountIn * factor;
    }
}