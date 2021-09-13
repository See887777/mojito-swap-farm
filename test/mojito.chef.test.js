const {
          accounts,
          contract,
      }           = require("@openzeppelin/test-environment");
const {
          BN,
          expectEvent,
          expectRevert,
          time,
      }           = require("@openzeppelin/test-helpers");
const {expect}    = require("chai");
const MojitoToken = contract.fromArtifact("MojitoToken");
const MasterChef  = contract.fromArtifact("MasterChef");

describe("MasterChef", () => {
    const [minter, alice, bob] = accounts;

    beforeEach(async () => {
        this.mojito = await MojitoToken.new({from: minter});
        this.lp1    = await MojitoToken.new({from: minter});
        this.lp2    = await MojitoToken.new({from: minter});
        this.lp3    = await MojitoToken.new({from: minter});
        this.chef   = await MasterChef.new(this.mojito.address, "1000", "100", {from: minter});
        const role  = await this.mojito.MINTER_ROLE();
        await this.mojito.grantRole(role, this.chef.address, {from: minter});

        await this.lp1.transfer(bob, "2000", {from: minter});
        await this.lp2.transfer(bob, "2000", {from: minter});
        await this.lp3.transfer(bob, "2000", {from: minter});

        await this.lp1.transfer(alice, "2000", {from: minter});
        await this.lp2.transfer(alice, "2000", {from: minter});
        await this.lp3.transfer(alice, "2000", {from: minter});
    });

    it("real case", async () => {
        this.lp4 = await MojitoToken.new({from: minter});
        this.lp5 = await MojitoToken.new({from: minter});
        this.lp6 = await MojitoToken.new({from: minter});
        this.lp7 = await MojitoToken.new({from: minter});
        this.lp8 = await MojitoToken.new({from: minter});
        this.lp9 = await MojitoToken.new({from: minter});
        await this.chef.add("2000", this.lp1.address, true, {from: minter});
        await this.chef.add("1000", this.lp2.address, true, {from: minter});
        await this.chef.add("500", this.lp3.address, true, {from: minter});
        await this.chef.add("500", this.lp4.address, true, {from: minter});
        await this.chef.add("500", this.lp5.address, true, {from: minter});
        await this.chef.add("500", this.lp6.address, true, {from: minter});
        await this.chef.add("500", this.lp7.address, true, {from: minter});
        await this.chef.add("100", this.lp8.address, true, {from: minter});
        await this.chef.add("100", this.lp9.address, true, {from: minter});
        expect(await this.chef.poolLength()).to.be.bignumber.equal(new BN(10));
        expect(await this.chef.totalAllocPoint()).to.be.bignumber.equal(new BN(7600));

        // Alice Deposit
        await time.advanceBlockTo("170");
        expect(await this.lp1.balanceOf(alice)).to.be.bignumber.equal(new BN("2000"));
        await this.lp1.approve(this.chef.address, "2000", {from: alice});
        const AliceDepositTx = await this.chef.deposit(1, "2000", {from: alice});
        expectEvent(AliceDepositTx,
            "Deposit",
            {
                user:   alice,
                pid:    "1",
                amount: "2000",
            });
        expect(await this.lp1.balanceOf(alice)).to.be.bignumber.equal(new BN(0));

        // Alice Withdraw(172)
        const AliceWithdrawTx = await this.chef.withdraw(1, "2000", {from: alice});
        expectEvent(AliceWithdrawTx,
            "Withdraw",
            {
                user:   alice,
                pid:    "1",
                amount: "2000",
            });
        expect(await this.lp1.balanceOf(alice)).to.be.bignumber.equal(new BN("2000"));
        // (172-171)*1000*2000/7600
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN("263"));

        // Alice EnterStaking(173)
        await this.mojito.approve(this.chef.address, "1000", {from: alice});
        await this.chef.enterStaking("20", {from: alice}); //174
        await this.chef.enterStaking("0", {from: alice});  //175
        await this.chef.enterStaking("0", {from: alice});  //176
        await this.chef.enterStaking("0", {from: alice});  //177

        // 263-20+1/4*(177-174)*1000
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN("993"));
        expect((await this.chef.poolInfo(0)).allocPoint).to.be.bignumber.equal("1900");
    });

    it("checkPoolDuplicate", async () => {
        await this.chef.add("2000", this.lp1.address, true, {from: minter});
        await expectRevert(this.chef.add("2000", this.lp1.address, true, {from: minter}), "MasterChef::add: existing pool");
    });

});
