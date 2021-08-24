const {
          accounts,
          contract,
      }              = require("@openzeppelin/test-environment");
const {
          BN,
          expectRevert,
          expectEvent,
          time,
      }              = require("@openzeppelin/test-helpers");
const {expect}       = require("chai");
const MojitoToken    = contract.fromArtifact("MojitoToken");
const MojitoTimelock = contract.fromArtifact("MojitoTimelock");


describe("MojitoTimelock", function () {
    const [caller, alice, bob] = accounts;

    before(async function () {
        this.now    = Math.floor(new Date().getTime() / 100);
        this.mojito = await MojitoToken.new({from: caller});
        this.self   = await MojitoTimelock.new(alice, this.mojito.address, 1000, this.now, 0, "TEAM", {from: caller});
        await this.mojito.transfer(this.self.address, 1000 * 8, {from: caller});
        expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(8000));
    });

    it("token()", async function () {
        expect(await this.self.token()).to.be.equal(this.mojito.address);
    });

    it("PERIOD()", async function () {
        expect(await this.self.PERIOD()).to.be.bignumber.equal(new BN(180 * 24 * 60 * 60));
    });

    it("CYCLE_TIMES()", async function () {
        expect(await this.self.CYCLE_TIMES()).to.be.bignumber.equal(new BN(8));
    });

    it("quantity()", async function () {
        expect(await this.self.quantity()).to.be.bignumber.equal(new BN(1000));
    });

    it("startTime()", async function () {
        expect(await this.self.startTime()).to.be.bignumber.equal(new BN(this.now));
    });

    it("delay()", async function () {
        expect(await this.self.delay()).to.be.bignumber.equal(new BN(0));
    });

    it("cycle()", async function () {
        expect(await this.self.cycle()).to.be.bignumber.equal(new BN(0));
    });

    it("hasReward()", async function () {
        expect(await this.self.hasReward()).to.be.bignumber.equal(new BN(0));
    });

    it("beneficiary()", async function () {
        expect(await this.self.beneficiary()).to.be.equal(alice);
    });

    it("description()", async function () {
        expect(await this.self.description()).to.be.equal("TEAM");
    });

    it("balanceOf()", async function () {
        expect(await this.self.balanceOf()).to.be.bignumber.equal(new BN(8000));
    });

    it("getReward()", async function () {
        expect(await this.self.getReward()).to.be.bignumber.equal(new BN(0));
    });

    it("withdraw()", async function () {
        await expectRevert(this.self.withdraw({from: caller}),
            "MojitoTimelock::withdraw: no tokens to release");
    });

    it.skip("withdraw()", async function () {
        for (let i = 0; i < 8; i++) {
            const timeTo = this.now + 3 + (i + 1) * 10;
            console.log(i + 1, this.now, timeTo);
            await time.increaseTo(timeTo);

            expect(await this.self.getReward()).to.be.bignumber.equal(new BN(1000));
            expectEvent(await this.self.withdraw({from: caller}),
                "Withdraw",
                {
                    operator: caller,
                    to:       alice,
                    amount:   "1000",
                });
            expect(await this.self.balanceOf()).to.be.bignumber.equal(new BN(8000 - (i + 1) * 1000));
            expect(await this.mojito.balanceOf(this.self.address)).to.be.bignumber.equal(new BN(8000 - (i + 1) * 1000));
            expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN((i + 1) * 1000));
            console.log("alice: ", (await this.mojito.balanceOf(alice)).toString());
        }
    });

    it("setBeneficiary(not beneficiary)", async function () {
        await expectRevert(this.self.setBeneficiary(bob, {from: caller}),
            "MojitoTimelock::setBeneficiary: not beneficiary");
    });

    it("setBeneficiary(beneficiary)", async function () {
        await this.self.setBeneficiary(bob, {from: alice});
        expect(await this.self.beneficiary()).to.be.equal(bob);
    });

});
