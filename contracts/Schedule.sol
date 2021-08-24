// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Schedule is Ownable {
    using SafeMath for uint256;

    uint256 public mintPeriodDuration = 5184000; //day 180
    uint256 public decayRateNumerator = 20;      //20%
    uint256 public decayRateDenominator = 100;   //
    uint256 public epochStartBlock = 0;          //the block number when mojito starts
    uint256 public mojitoPerBlock = 0;           //mojito tokens created per block

    event MintPeriodDurationTransferred(uint256 indexed previousMintPeriodDuration, uint256 indexed newMintPeriodDuration);
    event DecayRateNumeratorTransferred(uint256 indexed previousDecayRateNumerator, uint256 indexed newDecayRateNumerator);
    event EpochStartBlockTransferred(uint256 indexed previousEpochStartBlock, uint256 indexed newEpochStartBlock);
    event MojitoPerBlockTransferred(uint256 indexed previousMojitoPerBlock, uint256 indexed newMojitoPerBlock);

    constructor(uint256 _mojitoPerBlock) public {
        emit MojitoPerBlockTransferred(mojitoPerBlock, _mojitoPerBlock);
        mojitoPerBlock = _mojitoPerBlock;
    }

    function setMintPeriodDuration(uint256 _mintPeriodDuration) public onlyOwner {
        emit MintPeriodDurationTransferred(mintPeriodDuration, _mintPeriodDuration);
        mintPeriodDuration = _mintPeriodDuration;
    }

    function setDecayRateNumerator(uint256 _decayRateNumerator) public onlyOwner {
        require(_decayRateNumerator < decayRateDenominator, "Schedule::setDecayRateNumerator: _decayRateNumerator overflow");
        emit DecayRateNumeratorTransferred(decayRateNumerator, _decayRateNumerator);
        decayRateNumerator = _decayRateNumerator;
    }

    function setEpochStartBlock(uint256 _epochStartBlock) public onlyOwner {
        emit EpochStartBlockTransferred(epochStartBlock, _epochStartBlock);
        epochStartBlock = _epochStartBlock;
    }

    function setMojitoPerBlock(uint256 _mojitoPerBlock) public virtual onlyOwner {
        emit MojitoPerBlockTransferred(mojitoPerBlock, _mojitoPerBlock);
        mojitoPerBlock = _mojitoPerBlock;
    }

    function epoch(uint256 blockNumber) public view returns (uint256) {
        if (mintPeriodDuration == 0) {
            return 0;
        }
        if (blockNumber > epochStartBlock) {
            return (blockNumber.sub(epochStartBlock).sub(1)).div(mintPeriodDuration);
        }

        return 0;
    }

    function reward(uint256 blockNumber) public view returns (uint256) {
        uint256 currentEpoch = epoch(blockNumber);
        uint256 numerator = pow(decayRateDenominator.sub(decayRateNumerator), currentEpoch);
        uint256 denominator = pow(decayRateDenominator, currentEpoch);
        return mojitoPerBlock.mul(numerator).div(denominator);
    }

    function mintable(uint256 blockNumber) public view returns (uint256) {
        require(blockNumber <= block.number, "Schedule::mintable: blockNumber overflow");

        uint256 _mintable = 0;
        uint256 lastMintableBlock = blockNumber;
        uint256 n = epoch(lastMintableBlock);
        uint256 m = epoch(block.number);

        while (n < m) {
            n++;
            uint256 r = n.mul(mintPeriodDuration).add(epochStartBlock);
            _mintable = _mintable.add((r.sub(lastMintableBlock)).mul(reward(r)));
            lastMintableBlock = r;
        }
        _mintable = _mintable.add((block.number.sub(lastMintableBlock)).mul(reward(block.number)));

        return _mintable;
    }

    // https://mpark.github.io/programming/2014/08/18/exponentiation-by-squaring/
    function pow(uint256 x, uint256 n) internal pure returns (uint256) {
        uint256 result = 1;
        while (n > 0) {
            if (n % 2 != 0) {
                result = result.mul(x);
            }
            x = x.mul(x);
            n /= 2;
        }
        return result;
    }
}
