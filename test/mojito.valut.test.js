const {
          accounts,
          contract,
      }           = require("@openzeppelin/test-environment");
const {
          BN,
          expectEvent,
      }           = require("@openzeppelin/test-helpers");
const {expect}    = require("chai");
const MojitoToken = contract.fromArtifact("MojitoToken");
const MasterChef  = contract.fromArtifact("MasterChef");
const MojitoVault = contract.fromArtifact("MojitoVault");

describe("MojitoVault", () => {
    const [minter, alice, bob] = accounts;

    beforeEach(async () => {
        this.mojito = await MojitoToken.new({from: minter});
        this.chef   = await MasterChef.new(this.mojito.address, "1000", "100", {from: minter});
        this.vault  = await MojitoVault.new(this.mojito.address, this.chef.address, bob, bob, {from: minter});
        const role  = await this.mojito.MINTER_ROLE();
        await this.mojito.grantRole(role, this.chef.address, {from: minter});
        await this.mojito.transfer(alice, "2000", {from: minter});
    });

    it("real case", async () => {
        // Alice Deposit
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN("2000"));
        await this.mojito.approve(this.vault.address, "2000", {from: alice});
        const AliceDepositTx = await this.vault.deposit("2000", {from: alice});
        expectEvent(AliceDepositTx,
            "Deposit",
            {
                sender: alice,
                amount: "2000",
                shares: "2000",
            });
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN(0));

        // Alice Withdraw
        const AliceWithdrawTx = await this.vault.withdraw("2000", {from: alice});
        expectEvent(AliceWithdrawTx,
            "Withdraw",
            {
                sender: alice,
                amount: "1998",
                shares: "2000",
            });
        expect(await this.mojito.balanceOf(alice)).to.be.bignumber.equal(new BN("1998"));
    });

});
