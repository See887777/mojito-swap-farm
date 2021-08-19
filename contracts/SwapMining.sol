// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IMojitoFactory.sol";
import "./interfaces/IMojitoOracle.sol";
import "./interfaces/IMojitoRouter.sol";
import "./interfaces/IMojitoToken.sol";
import "./Schedule.sol";

contract SwapMining is Schedule, AccessControl {
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 quantity;     // How many quantity the user has swaped.
        uint256 blockNumber;  // Last transaction block.
    }

    // Info of each pool.
    struct PoolInfo {
        address lpToken;            // Address of LP token contract.
        uint256 allocPoint;         // How many allocation points assigned to this pool. MJTs to distribute per block.
        uint256 lastRewardBlock;    // Last block number that MJTs distribution occurs.
        uint256 quantity;           // Current amount of LPs
        uint256 totalQuantity;      // All quantity
        uint256 allocMdxAmount;     // How many MDXs
    }

    // The Mojito token
    IMojitoToken public mojito;
    // The swap router
    IMojitoRouter router;
    // The swap factory
    IMojitoFactory factory;
    // The price oracle
    IMojitoOracle oracle;
    // The base coin
    address usdt;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Pair corresponding pid
    mapping(address => uint256) public pairOfPid;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when Mojito mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IMojitoToken _mojito,
        IMojitoRouter _router,
        IMojitoOracle _oracle,
        address _usdt,
        uint256 _mojitoPerBlock,
        uint256 _startBlock
    ) public Schedule(_mojitoPerBlock) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        mojito = _mojito;
        router = _router;
        factory = IMojitoFactory(router.factory());
        oracle = _oracle;
        usdt = _usdt;
        startBlock = _startBlock;
    }

    function poolLength() public view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, address _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
        lpToken : _lpToken,
        allocPoint : _allocPoint,
        lastRewardBlock : lastRewardBlock,
        quantity : 0,
        totalQuantity : 0,
        allocMdxAmount : 0
        }));

        pairOfPid[_lpToken] = poolLength() - 1;
    }

    // Update the given pool's Mojito allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setMojitoPerBlock(uint256 _mojitoPerBlock) public virtual override onlyOwner {
        massUpdatePools();
        super.setMojitoPerBlock(_mojitoPerBlock);
    }

    function setRouter(IMojitoRouter _router) public onlyOwner {
        require(address(_router) != address(0), "SwapMining::setRouter: _router is the zero address");
        router = _router;
        factory = IMojitoFactory(router.factory());
    }

    function setOracle(IMojitoOracle _oracle) public onlyOwner {
        require(address(_oracle) != address(0), "SwapMining::setOracle: _oracle is the zero address");
        oracle = _oracle;
    }

    function isWhitelist(address token) public view returns (bool) {
        return hasRole(WHITELIST_ROLE, token);
    }

    // View function to see pending MJTs on frontend.
    function pendingMojito(uint256 _pid) external view returns (uint256) {
        require(_pid <= poolInfo.length - 1, "SwapMining::pendingMojito: not find this pool");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 allocMdxAmount = pool.allocMdxAmount;
        if (user.quantity > 0) {
            uint256 blockReward = mintable(pool.lastRewardBlock);
            uint256 mojitoReward = blockReward.mul(pool.allocPoint).div(totalAllocPoint);
            allocMdxAmount = allocMdxAmount.add(mojitoReward);
        }

        return user.quantity.mul(allocMdxAmount).div(pool.quantity);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        if (pool.quantity == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 blockReward = mintable(pool.lastRewardBlock);
        if (blockReward <= 0) {
            return;
        }
        uint256 mojitoReward = blockReward.mul(pool.allocPoint).div(totalAllocPoint);
        mojito.mint(address(this), mojitoReward);
        pool.allocMdxAmount = pool.allocMdxAmount.add(mojitoReward);
        pool.lastRewardBlock = block.number;
    }

    //
    function swap(address account, address input, address output, uint256 amount) public onlyRouter returns (bool) {
        require(account != address(0), "SwapMining::swap: taker swap account is the zero address");
        require(input != address(0), "SwapMining::swap: taker swap input is the zero address");
        require(output != address(0), "SwapMining::swap: taker swap output is the zero address");

        if (poolLength() <= 0) {
            return false;
        }
        ///这两个币种需要在白名单中
        if (!isWhitelist(input) || !isWhitelist(output)) {
            return false;
        }

        // if it does not exist or the alloc-point is 0 then return
        address pair = IMojitoFactory(factory).getPair(input, output);
        PoolInfo storage pool = poolInfo[pairOfPid[pair]];
        if (pool.lpToken != pair || pool.allocPoint <= 0) {
            return false;
        }

        //
        uint256 quantity = getQuantity(output, amount, usdt);
        if (quantity <= 0) {
            return false;
        }

        updatePool(pairOfPid[pair]);

        pool.quantity = pool.quantity.add(quantity);
        pool.totalQuantity = pool.totalQuantity.add(quantity);
        UserInfo storage user = userInfo[pairOfPid[pair]][account];
        user.quantity = user.quantity.add(quantity);
        user.blockNumber = block.number;

        return true;
    }

    // The user withdraws all the transaction rewards of the pool
    function withdraw() public {
        uint256 userSub;
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            PoolInfo storage pool = poolInfo[pid];
            UserInfo storage user = userInfo[pid][msg.sender];
            if (user.quantity > 0) {
                updatePool(pid);

                // The reward held by the user in this pool
                uint256 userReward = pool.allocMdxAmount.mul(user.quantity).div(pool.quantity);
                pool.quantity = pool.quantity.sub(user.quantity);
                pool.allocMdxAmount = pool.allocMdxAmount.sub(userReward);
                user.quantity = 0;
                user.blockNumber = block.number;
                userSub = userSub.add(userReward);
            }
        }

        if (userSub <= 0) {
            return;
        }

        safeMojitoTransfer(msg.sender, userSub);
    }

    function getQuantity(address outputToken, uint256 outputAmount, address anchorToken) public view returns (uint256) {
        uint256 quantity = 0;

        if (outputToken == anchorToken) {
            quantity = outputAmount;
        } else if (factory.getPair(outputToken, anchorToken) != address(0)) {
            quantity = oracle.consult(outputToken, outputAmount, anchorToken);
        } else {
            uint256 length = getRoleMemberCount(WHITELIST_ROLE);
            for (uint256 index = 0; index < length; index++) {
                address intermediate = getRoleMember(WHITELIST_ROLE, index);
                if (factory.getPair(outputToken, intermediate) != address(0) && factory.getPair(intermediate, anchorToken) != address(0)) {
                    uint256 interQuantity = oracle.consult(outputToken, outputAmount, intermediate);
                    quantity = oracle.consult(intermediate, interQuantity, anchorToken);
                    break;
                }
            }
        }

        return quantity;
    }

    // Safe mojito transfer function, just in case if rounding error causes pool to not have enough MJTs.
    function safeMojitoTransfer(address _to, uint256 _amount) internal {
        uint256 mojitoBal = mojito.balanceOf(address(this));
        if (_amount > mojitoBal) {
            mojito.transfer(_to, mojitoBal);
        } else {
            mojito.transfer(_to, _amount);
        }
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "SwapMining::onlyRouter: caller is not the router");
        _;
    }
}