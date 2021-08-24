const {
          accounts,
          contract,
      }                 = require("@openzeppelin/test-environment");
const {
          BN,
          expectEvent,
          expectRevert,
          constants,
          time,
      }                 = require("@openzeppelin/test-helpers");
const {expect}          = require("chai");
const MojitoToken       = contract.fromArtifact("MojitoToken");
const MojitoFactoryMock = contract.fromArtifact("MojitoFactoryMock");
const MojitoOracleMock  = contract.fromArtifact("MojitoOracleMock");
const MojitoRouterMock  = contract.fromArtifact("MojitoRouterMock");
const SwapMining        = contract.fromArtifact("SwapMining");

describe("SwapMining", () => {
    const [caller, alice, bob] = accounts;

    before(async () => {
        this.mojito  = await MojitoToken.new({from: caller});
        this.usdt    = await MojitoToken.new({from: caller});
        this.factory = await MojitoFactoryMock.new({from: caller});
        this.oracle  = await MojitoOracleMock.new({from: caller});
        this.router  = await MojitoRouterMock.new(this.factory.address, {from: caller});
        this.self    = await SwapMining.new(
            this.mojito.address,
            this.router.address,
            this.oracle.address,
            this.usdt.address,
            "1000",
            "100",
            {from: caller});
        await this.router.setSwapMining(this.self.address);
        this.lp1 = await MojitoToken.new({from: caller});
        this.lp2 = await MojitoToken.new({from: caller});

        const role = await this.mojito.MINTER_ROLE();
        await this.mojito.grantRole(role, this.self.address, {from: caller});
    });

    it("poolLength()", async () => {
        expect(await this.self.poolLength()).to.be.bignumber.equal(new BN(0));
    });

    it("add()", async () => {
        // lp1
        await this.self.add(1000, this.lp1.address, false, {from: caller});
        expect(await this.self.pairOfPid(this.lp1.address)).to.be.bignumber.equal(new BN(0));
        const pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(1000));
        expect(await this.self.totalAllocPoint()).to.be.bignumber.equal(new BN(1000));
        expect(await this.self.poolLength()).to.be.bignumber.equal(new BN(1));

        // lp2
        await this.self.add(2000, this.lp2.address, false, {from: caller});
        expect(await this.self.pairOfPid(this.lp2.address)).to.be.bignumber.equal(new BN(1));
        const pool1 = await this.self.poolInfo(1);
        expect(pool1.lpToken).to.be.equal(this.lp2.address);
        expect(pool1.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(await this.self.totalAllocPoint()).to.be.bignumber.equal(new BN(3000));
        expect(await this.self.poolLength()).to.be.bignumber.equal(new BN(2));
    });

    it("set(owner)", async () => {
        await this.self.set(0, 2000, false, {from: caller});
        expect(await this.self.pairOfPid(this.lp1.address)).to.be.bignumber.equal(new BN(0));
        const pool2 = await this.self.poolInfo(0);
        expect(pool2.lpToken).to.be.equal(this.lp1.address);
        expect(pool2.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(await this.self.totalAllocPoint()).to.be.bignumber.equal(new BN(4000));
    });

    it("set(not owner)", async () => {
        expect(await this.self.poolLength()).to.be.bignumber.equal(new BN(2));
        await expectRevert(this.self.set(0, 2000, false), "Ownable: caller is not the owner");
    });

    it("setRouter(owner)", async () => {
        expect(await this.self.router()).to.be.equal(this.router.address);
        const router = await MojitoRouterMock.new(this.factory.address, {from: caller});
        await this.self.setRouter(router.address, {from: caller});
        expect(await this.self.router()).to.be.equal(router.address);
        expect(await this.self.factory()).to.be.equal(this.factory.address);
        this.router = router;
        await this.router.setSwapMining(this.self.address, {from: caller});
    });

    it("setRouter(not owner)", async () => {
        await expectRevert(this.self.setRouter(this.router.address), "Ownable: caller is not the owner");
    });

    it("setRouter(zero address)", async () => {
        await expectRevert(this.self.setRouter(constants.ZERO_ADDRESS, {from: caller}), "SwapMining::setRouter: _router is the zero address");
    });

    it("setOracle(owner)", async () => {
        expect(await this.self.oracle()).to.be.equal(this.oracle.address);
        const oracle = await MojitoOracleMock.new({from: caller});
        await this.self.setOracle(oracle.address, {from: caller});
        expect(await this.self.oracle()).to.be.equal(oracle.address);
        this.oracle = oracle;
    });

    it("setOracle(not owner)", async () => {
        await expectRevert(this.self.setOracle(this.router.address), "Ownable: caller is not the owner");
    });

    it("setOracle(zero address)", async () => {
        await expectRevert(this.self.setOracle(constants.ZERO_ADDRESS, {from: caller}), "SwapMining::setOracle: _oracle is the zero address");
    });

    it("isWhitelist()", async () => {
        expect(await this.self.isWhitelist(this.usdt.address)).to.be.equal(false);
    });

    it("setWhitelist()", async () => {
        const role = await this.self.WHITELIST_ROLE();
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(0));
        expectEvent(await this.self.grantRole(role, this.usdt.address, {from: caller}),
            "RoleGranted",
            {
                role:    role,
                account: this.usdt.address,
                sender:  caller,
            });
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(1));
        expect(await this.self.hasRole(role, this.usdt.address)).to.be.equal(true);
        expect(await this.self.isWhitelist(this.usdt.address)).to.be.equal(true);

        expectEvent(await this.self.grantRole(role, this.mojito.address, {from: caller}),
            "RoleGranted",
            {
                role:    role,
                account: this.mojito.address,
                sender:  caller,
            });
    });

    it("swap(alice)", async () => {
        // swap xx USDT to 1000MJT, 1MJT=10USDT
        expect(await this.router.swapMining()).to.be.equal(this.self.address);
        await this.factory.setPair(this.lp1.address);
        await this.oracle.setFactor(10);
        await time.advanceBlockTo("269");
        await this.router.swap(alice, this.usdt.address, this.mojito.address, 1000, {from: caller});

        const pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(10000));

        const userInfo = await this.self.userInfo(0, alice);
        expect(userInfo.quantity).to.be.bignumber.equal(new BN(10000));
        expect(userInfo.blockNumber).to.be.bignumber.equal(new BN(270));
    });

    it("pendingMojito(alice)", async () => {
        await time.advanceBlockTo("369");

        // (369-270)*1000*(2000)/4000*10000/10000=50000
        expect(await this.self.pendingMojito(0, {from: alice})).to.be.bignumber.equal(new BN(49500));
    });

    it("updatePool(alice)", async () => {
        await this.self.updatePool(0);

        // (370-270)*1000*(2000)/4000*10000/10000=50500
        const pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.allocMojitoAmount).to.be.bignumber.equal(new BN(50000));
    });

    it("withdraw(alice)", async () => {
        expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(50000));

        // (371-370)*1000*(2000)/4000*10000/10000=500
        await this.self.withdraw({from: alice});

        const pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(0));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.allocMojitoAmount).to.be.bignumber.equal(new BN(0));

        const userInfo = await this.self.userInfo(0, alice);
        expect(userInfo.quantity).to.be.bignumber.equal(new BN(0));
        expect(userInfo.blockNumber).to.be.bignumber.equal(new BN(371));
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN(50000 + 500));
        expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(0));
    });

    it("swap(alice+bob)", async () => {
        // swap xx USDT to 1000MJT, 1MJT=10USDT
        expect(await this.router.swapMining()).to.be.equal(this.self.address);
        await this.factory.setPair(this.lp1.address);
        await this.oracle.setFactor(10);
        await time.advanceBlockTo("569");
        await this.router.swap(alice, this.usdt.address, this.mojito.address, 1000, {from: caller});
        await this.router.swap(bob, this.usdt.address, this.mojito.address, 1000, {from: caller});

        let pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(20000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(30000));

        let userInfoAlice = await this.self.userInfo(0, alice);
        expect(userInfoAlice.quantity).to.be.bignumber.equal(new BN(10000));
        expect(userInfoAlice.blockNumber).to.be.bignumber.equal(new BN(570));

        const userInfoBob = await this.self.userInfo(0, bob);
        expect(userInfoBob.quantity).to.be.bignumber.equal(new BN(10000));
        expect(userInfoBob.blockNumber).to.be.bignumber.equal(new BN(571));

        // alice withdraw
        await time.advanceBlockTo("669");
        //  (670-570)*1000*(2000)/4000*10000/20000=25000
        await this.self.withdraw({from: alice});

        pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(30000));
        expect(pool.allocMojitoAmount).to.be.bignumber.equal(new BN(25000));

        const userInfo = await this.self.userInfo(0, alice);
        expect(userInfo.quantity).to.be.bignumber.equal(new BN(0));
        expect(userInfo.blockNumber).to.be.bignumber.equal(new BN(670));
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN(50000 + 500 + 25000));
        expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(25000));

        // alice swap
        await time.advanceBlockTo("769");
        await this.router.swap(alice, this.usdt.address, this.mojito.address, 1000, {from: caller});
        pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(20000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(40000));

        userInfoAlice = await this.self.userInfo(0, alice);
        expect(userInfoAlice.quantity).to.be.bignumber.equal(new BN(10000));
        expect(userInfoAlice.blockNumber).to.be.bignumber.equal(new BN(770));

        // alice withdraw
        await time.advanceBlockTo("869");
        // 25000/2+(870-670)*1000*(2000)/4000*10000/20000=62500
        await this.self.withdraw({from: alice});

        pool = await this.self.poolInfo(0);
        expect(pool.lpToken).to.be.equal(this.lp1.address);
        expect(pool.allocPoint).to.be.bignumber.equal(new BN(2000));
        expect(pool.quantity).to.be.bignumber.equal(new BN(10000));
        expect(pool.totalQuantity).to.be.bignumber.equal(new BN(40000));
        expect(pool.allocMojitoAmount).to.be.bignumber.equal(new BN(62500));

        userInfoAlice = await this.self.userInfo(0, alice);
        expect(userInfoAlice.quantity).to.be.bignumber.equal(new BN(0));
        expect(userInfoAlice.blockNumber).to.be.bignumber.equal(new BN(870));
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN(50000 + 500 + 25000 + 62500));
        expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(62500));
    });

});
