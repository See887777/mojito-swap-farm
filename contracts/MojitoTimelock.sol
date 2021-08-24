// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MojitoTimelock {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public token;
    uint constant  public PERIOD = 180 days;    // 0.5 year
    uint constant  public CYCLE_TIMES = 8;      // 8 time
    uint public quantity;                       // Annual rewards are fixed
    uint public startTime;                      // Timestamp when token release is enabled
    uint public delay;                          // Delay time
    uint public cycle;                          // Cycle already received
    uint public hasReward;                      // Rewards already withdrawn
    address public beneficiary;                 // Beneficiary of tokens after they are released
    string public description;                  // Timelock detail

    event Withdraw(address indexed operator, address indexed to, uint amount);

    constructor(
        address _beneficiary,
        address _token,
        uint _quantity,
        uint _startTime,
        uint _delay,
        string memory _description
    ) public {
        require(_beneficiary != address(0) && _token != address(0), "MojitoTimelock: zero address");
        require(_quantity > 0, "MojitoTimelock: _quantity is zero");

        token = IERC20(_token);
        quantity = _quantity;
        startTime = _startTime.add(_delay);
        delay = _delay;
        beneficiary = _beneficiary;
        description = _description;
    }

    function balanceOf() public view returns (uint) {
        return token.balanceOf(address(this));
    }

    function getReward() public view returns (uint) {
        if (cycle >= CYCLE_TIMES || block.timestamp <= startTime) {
            return 0;
        }
        uint pCycle = (block.timestamp.sub(startTime)).div(PERIOD);
        if (pCycle >= CYCLE_TIMES) {
            return token.balanceOf(address(this));
        }
        return pCycle.sub(cycle).mul(quantity);
    }

    function withdraw() external {
        uint reward = getReward();
        require(reward > 0, "MojitoTimelock::withdraw: no tokens to release");

        uint pCycle = (block.timestamp.sub(startTime)).div(PERIOD);
        cycle = pCycle >= CYCLE_TIMES ? CYCLE_TIMES : pCycle;

        hasReward = hasReward.add(reward);
        token.safeTransfer(beneficiary, reward);

        emit Withdraw(msg.sender, beneficiary, reward);
    }

    function setBeneficiary(address _beneficiary) public {
        require(msg.sender == beneficiary, "MojitoTimelock::setBeneficiary: not beneficiary");
        beneficiary = _beneficiary;
    }
}