const {
          accounts,
          contract,
      }        = require("@openzeppelin/test-environment");
const {
          BN,
          expectRevert,
      }        = require("@openzeppelin/test-helpers");
const {expect} = require("chai");
const Schedule = contract.fromArtifact("Schedule");


describe("Schedule", function () {
    const [caller, other] = accounts;
    before(async function () {
        this.self = await Schedule.new("3000000000000000000", {from: caller});
    });

    it("mintPeriodDuration()", async function () {
        expect(await this.self.mintPeriodDuration()).to.be.bignumber.equal(new BN(5184000));
    });

    it("decayRateNumerator()", async function () {
        expect(await this.self.decayRateNumerator()).to.be.bignumber.equal(new BN(20));
    });

    it("decayRateDenominator()", async function () {
        expect(await this.self.decayRateDenominator()).to.be.bignumber.equal(new BN(100));
    });

    it("epochStartBlock()", async function () {
        expect(await this.self.epochStartBlock()).to.be.bignumber.equal(new BN(0));
    });

    it("mojitoPerBlock()", async function () {
        expect(await this.self.mojitoPerBlock()).to.be.bignumber.equal(new BN("3000000000000000000"));
    });

    it("setMintPeriodDuration(caller)", async function () {
        await this.self.setMintPeriodDuration(3, {from: caller});
        expect(await this.self.mintPeriodDuration()).to.be.bignumber.equal(new BN(3));
    });

    it("setMintPeriodDuration(not caller)", async function () {
        await expectRevert(this.self.setMintPeriodDuration(1, {from: other}), "Ownable: caller is not the owner");
    });

    it("setDecayRateNumerator(caller)", async function () {
        await this.self.setDecayRateNumerator(50, {from: caller});
        expect(await this.self.decayRateNumerator()).to.be.bignumber.equal(new BN(50));

        await this.self.setDecayRateNumerator(20, {from: caller});
        expect(await this.self.decayRateNumerator()).to.be.bignumber.equal(new BN(20));
    });

    it("setDecayRateNumerator(not caller)", async function () {
        await expectRevert(this.self.setDecayRateNumerator(50, {from: other}), "Ownable: caller is not the owner");
    });

    it("setDecayRateNumerator(overflow)", async function () {
        await expectRevert(this.self.setDecayRateNumerator(100, {from: caller}), "Schedule::setDecayRateNumerator: _decayRateNumerator overflow");
    });

    it("setEpochStartBlock(caller)", async function () {
        await this.self.setEpochStartBlock(50, {from: caller});
        expect(await this.self.epochStartBlock()).to.be.bignumber.equal(new BN(50));
    });

    it("setEpochStartBlock(not caller)", async function () {
        await expectRevert(this.self.setEpochStartBlock(50, {from: other}), "Ownable: caller is not the owner");
    });

    it("setMojitoPerBlock(caller)", async function () {
        await this.self.setMojitoPerBlock("2250000000000000000", {from: caller});
        expect(await this.self.mojitoPerBlock()).to.be.bignumber.equal(new BN("2250000000000000000"));

        await this.self.setMojitoPerBlock("3000000000000000000", {from: caller});
        expect(await this.self.mojitoPerBlock()).to.be.bignumber.equal(new BN("3000000000000000000"));
    });

    it("setMojitoPerBlock(not caller)", async function () {
        await expectRevert(this.self.setMojitoPerBlock(50, {from: other}), "Ownable: caller is not the owner");
    });

    it("epoch(mintPeriodDuration=0)", async function () {
        await this.self.setMintPeriodDuration(0, {from: caller});
        expect(await this.self.mintPeriodDuration()).to.be.bignumber.equal(new BN(0));
        expect(await this.self.epoch(100)).to.be.bignumber.equal(new BN(0));
    });

    it("epoch(blockNumber>epochStartBlock)", async function () {
        await this.self.setMintPeriodDuration(300, {from: caller});
        expect(await this.self.mintPeriodDuration()).to.be.bignumber.equal(new BN(300));
        await this.self.setEpochStartBlock(300, {from: caller});
        expect(await this.self.epochStartBlock()).to.be.bignumber.equal(new BN(300));
        expect(await this.self.epoch(301)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.epoch(600)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.epoch(601)).to.be.bignumber.equal(new BN(1));
    });

    it("epoch(blockNumber<=epochStartBlock)", async function () {
        expect(await this.self.epoch(299)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.epoch(300)).to.be.bignumber.equal(new BN(0));
    });

    it("reward", async function () {
        expect(await this.self.reward(299)).to.be.bignumber.equal(new BN("3000000000000000000"));
        expect(await this.self.reward(300)).to.be.bignumber.equal(new BN("3000000000000000000"));
        expect(await this.self.reward(301)).to.be.bignumber.equal(new BN("3000000000000000000"));
        expect(await this.self.reward(601)).to.be.bignumber.equal(new BN("2400000000000000000"));
        expect(await this.self.reward(901)).to.be.bignumber.equal(new BN("1920000000000000000"));
        expect(await this.self.reward(1201)).to.be.bignumber.equal(new BN("1536000000000000000"));
        expect(await this.self.reward(1501)).to.be.bignumber.equal(new BN("1228800000000000000"));
        expect(await this.self.reward(1801)).to.be.bignumber.equal(new BN("983040000000000000"));
        expect(await this.self.reward(2101)).to.be.bignumber.equal(new BN("786432000000000000"));
        expect(await this.self.reward(2401)).to.be.bignumber.equal(new BN("629145600000000000"));
        expect(await this.self.reward(2701)).to.be.bignumber.equal(new BN("503316480000000000"));
        expect(await this.self.reward(3001)).to.be.bignumber.equal(new BN("402653184000000000"));
        expect(await this.self.reward(3301)).to.be.bignumber.equal(new BN("322122547200000000"));
        expect(await this.self.reward(3601)).to.be.bignumber.equal(new BN("257698037760000000"));
        expect(await this.self.reward(3901)).to.be.bignumber.equal(new BN("206158430208000000"));
        expect(await this.self.reward(4201)).to.be.bignumber.equal(new BN("164926744166400000"));
        expect(await this.self.reward(4501)).to.be.bignumber.equal(new BN("131941395333120000"));
        expect(await this.self.reward(4801)).to.be.bignumber.equal(new BN("105553116266496000"));
        expect(await this.self.reward(5101)).to.be.bignumber.equal(new BN("84442493013196800"));
        expect(await this.self.reward(5401)).to.be.bignumber.equal(new BN("67553994410557440"));
        expect(await this.self.reward(5701)).to.be.bignumber.equal(new BN("54043195528445952"));
        expect(await this.self.reward(6001)).to.be.bignumber.equal(new BN("43234556422756761"));
        expect(await this.self.reward(6301)).to.be.bignumber.equal(new BN("34587645138205409"));
        expect(await this.self.reward(6701)).to.be.bignumber.equal(new BN("27670116110564327"));
        expect(await this.self.reward(7001)).to.be.bignumber.equal(new BN("22136092888451461"));
    });

    it("mintable(blockNumber>block.number)", async function () {
        await expectRevert(this.self.mintable(50), "Schedule:blockNumber overflow");
    });

    it.skip("mintable(mock)", async function () {
        expect(await this.self.mintable(299, 300)).to.be.bignumber.equal(new BN("3000000000000000000"));
        expect(await this.self.mintable(300, 300)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.mintable(300, 305)).to.be.bignumber.equal(new BN("15000000000000000000"));
        expect(await this.self.mintable(300, 400)).to.be.bignumber.equal(new BN("300000000000000000000"));
        expect(await this.self.mintable(300, 600)).to.be.bignumber.equal(new BN("900000000000000000000"));
        expect(await this.self.mintable(300, 601)).to.be.bignumber.equal(new BN("902400000000000000000"));
        expect(await this.self.mintable(300, 901)).to.be.bignumber.equal(new BN("1621920000000000000000"));
        expect(await this.self.mintable(300, 1201)).to.be.bignumber.equal(new BN("2197536000000000000000"));
    });

});
