const Ethers      = require("ethers");
const {
          accounts,
          contract,
          privateKeys,
      }           = require("@openzeppelin/test-environment");
const {
          BN,
          constants,
          expectEvent,
      }           = require("@openzeppelin/test-helpers");
const {expect}    = require("chai");
const MojitoToken = contract.fromArtifact("MojitoToken");

async function eip712(privateKey, data) {
    const wallet    = new Ethers.Wallet(privateKey);
    const signature = await wallet._signTypedData(data.domain, data.types, data.value);
    const result    = Ethers.utils.splitSignature(signature);

    return {
        r: result.r,
        s: result.s,
        v: result.v,
    };
}

describe("MojitoToken", function () {
    const [caller, Charlie, Bob, Alice, Malice, Trudy] = accounts;
    const [_, charlie, bob, alice]                     = privateKeys;

    before(async function () {
        this.self = await MojitoToken.new({from: caller});
    });

    it("name()", async function () {
        expect(await this.self.name()).to.be.equal("MojitoToken");
    });

    it("symbol()", async function () {
        expect(await this.self.symbol()).to.be.equal("MJT");
    });

    it("decimals()", async function () {
        expect(await this.self.decimals()).to.be.bignumber.equal(new BN(18));
    });

    it("totalSupply()", async function () {
        expect(await this.self.totalSupply()).to.be.bignumber.equal(new BN("25000000000000000000000000"));
    });

    it("balanceOf()", async function () {
        expect(await this.self.balanceOf(caller)).to.be.bignumber.equal(new BN("25000000000000000000000000"));
    });

    it("delegates()", async function () {
        expect(await this.self.delegates(Bob)).to.be.equal(constants.ZERO_ADDRESS);
    });

    it("numCheckpoints()", async function () {
        expect(await this.self.numCheckpoints(Bob)).to.be.bignumber.equal(new BN(0));
    });

    it("checkpoints()", async function () {
        expect((await this.self.checkpoints(Bob, 0)).votes).to.be.bignumber.equal(new BN(0));
    });

    it("transfer()", async function () {
        expect(await this.self.delegates(caller)).to.be.equal(constants.ZERO_ADDRESS);
        expect(await this.self.delegates(Bob)).to.be.equal(constants.ZERO_ADDRESS);

        // Initial State
        expectEvent(await this.self.transfer(Bob, "100000000000000000000", {from: caller}),
            "Transfer",
            {
                from:  caller,
                to:    Bob,
                value: "100000000000000000000",
            });
        expect(await this.self.balanceOf(caller)).to.be.bignumber.equal(new BN("24999900000000000000000000"));
        expect(await this.self.balanceOf(Bob)).to.be.bignumber.equal(new BN("100000000000000000000"));
        expect(await this.self.numCheckpoints(caller)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.numCheckpoints(Bob)).to.be.bignumber.equal(new BN(0));

        // Bob delegates his 100 MJTs to Charlie
        const Bob2CharlieDelagateTx = await this.self.delegate(Charlie, {from: Bob});
        expectEvent(Bob2CharlieDelagateTx,
            "DelegateChanged",
            {
                delegator:    Bob,
                fromDelegate: constants.ZERO_ADDRESS,
                toDelegate:   Charlie,
            });
        expectEvent(Bob2CharlieDelagateTx,
            "DelegateVotesChanged",
            {
                delegate:        Charlie,
                previousBalance: new BN(0),
                newBalance:      new BN("100000000000000000000"),
            });
        expect(await this.self.delegates(Bob)).to.be.equal(Charlie);
        expect(await this.self.balanceOf(Bob)).to.be.bignumber.equal(new BN("100000000000000000000"));
        expect(await this.self.balanceOf(Charlie)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.numCheckpoints(Charlie)).to.be.bignumber.equal(new BN(1));
        expect(await this.self.numCheckpoints(Bob)).to.be.bignumber.equal(new BN(0));
        expect((await this.self.checkpoints(Charlie, 0)).votes).to.be.bignumber.equal(new BN("100000000000000000000"));

        // Bob transfers his 100 MJTs to Alice
        expectEvent(await this.self.transfer(Alice, "100000000000000000000", {from: Bob}),
            "Transfer",
            {
                from:  Bob,
                to:    Alice,
                value: "100000000000000000000",
            });
        expect(await this.self.balanceOf(Bob)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.balanceOf(Alice)).to.be.bignumber.equal(new BN("100000000000000000000"));
        expect(await this.self.numCheckpoints(Charlie)).to.be.bignumber.equal(new BN(2));
        expect(await this.self.numCheckpoints(Bob)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.numCheckpoints(Alice)).to.be.bignumber.equal(new BN(0));
        expect((await this.self.checkpoints(Charlie, 0)).votes).to.be.bignumber.equal(new BN("100000000000000000000"));
        expect((await this.self.checkpoints(Charlie, 1)).votes).to.be.bignumber.equal(new BN(0));
    });

    it("permit()", async function () {
        const rawdata               = {
            domain: {
                name:              await this.self.name(),
                chainId:           "1",
                verifyingContract: this.self.address,
            },
            types:  {
                Permit: [
                    {
                        name: "owner",
                        type: "address",
                    },
                    {
                        name: "spender",
                        type: "address",
                    },
                    {
                        name: "value",
                        type: "uint256",
                    },
                    {
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        name: "deadline",
                        type: "uint256",
                    },
                ],
            },
            value:  {
                "owner":    Alice,
                "spender":  Malice,
                "value":    1,
                "nonce":    0,
                "deadline": 12222222222222,
            },
        };
        const result                = await eip712(alice, rawdata);
        const Alice2MaliceApproveTx = await this.self.permit(
            Alice,
            Malice,
            new BN("1"),
            12222222222222,
            result.v,
            result.r,
            result.s,
            {from: caller});
        expectEvent(Alice2MaliceApproveTx,
            "Approval",
            {
                owner:   Alice,
                spender: Malice,
                value:   "1",
            });
        expect(await this.self.allowance(Alice, Malice)).to.be.bignumber.equal(new BN("1"));
    });

    it("delegateBySig()", async function () {
        expect(await this.self.delegates(Bob)).to.be.equal(Charlie);
        expect(await this.self.delegates(Alice)).to.be.equal(constants.ZERO_ADDRESS);
        // Alice delegates her 100 MJTs to Charlie
        const rawdata                 = {
            domain: {
                name:              await this.self.name(),
                chainId:           "1",
                verifyingContract: this.self.address,
            },
            types:  {
                Delegation: [
                    {
                        name: "delegatee",
                        type: "address",
                    },
                    {
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        name: "expiry",
                        type: "uint256",
                    },
                ],
            },
            value:  {
                "delegatee": Charlie,
                "nonce":     1,
                "expiry":    12222222222222,
            },
        };
        const result                  = await eip712(alice, rawdata);
        const Alice2CharlieDeleagteTx = await this.self.delegateBySig(
            Charlie,
            1,
            12222222222222,
            result.v,
            result.r,
            result.s,
            {from: caller});
        expectEvent(Alice2CharlieDeleagteTx,
            "DelegateChanged",
            {
                delegator:    Alice,
                fromDelegate: constants.ZERO_ADDRESS,
                toDelegate:   Charlie,
            });
        expectEvent(Alice2CharlieDeleagteTx,
            "DelegateVotesChanged",
            {
                delegate:        Charlie,
                previousBalance: new BN(0),
                newBalance:      new BN("100000000000000000000"),
            });
        expect(await this.self.delegates(Alice)).to.be.equal(Charlie);
        expect((await this.self.checkpoints(Charlie, 2)).votes).to.be.bignumber.equal(new BN("100000000000000000000"));
    });

    it("getCurrentVotes()", async function () {
        expect(await this.self.getCurrentVotes(Charlie)).to.be.bignumber.equal(new BN("100000000000000000000"));
    });

    it("getPriorVotes()", async function () {
        expect(await this.self.getPriorVotes(Charlie, 0)).to.be.bignumber.equal(new BN(0));
        expect(await this.self.getPriorVotes(Charlie, 3)).to.be.bignumber.equal(new BN("100000000000000000000"));
        expect(await this.self.getPriorVotes(Charlie, 4)).to.be.bignumber.equal(new BN(0));
    });

    it("setMinter()", async function () {
        const role = await this.self.MINTER_ROLE();
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(0));
        expectEvent(await this.self.grantRole(role, Trudy, {from: caller}),
            "RoleGranted",
            {
                role:    role,
                account: Trudy,
                sender:  caller,
            });
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(1));
        expect(await this.self.hasRole(role, Trudy)).to.be.equal(true);
    });

    it("mint()", async function () {
        expect(await this.self.totalSupply()).to.be.bignumber.equal(new BN("25000000000000000000000000"));
        expect(await this.self.balanceOf(Trudy)).to.be.bignumber.equal(new BN("0"));
        expectEvent(await this.self.mint(Trudy, "5000000000000000000000000", {from: Trudy}),
            "Transfer",
            {
                from:  constants.ZERO_ADDRESS,
                to:    Trudy,
                value: "5000000000000000000000000",
            });
        expect(await this.self.balanceOf(Trudy)).to.be.bignumber.equal(new BN("5000000000000000000000000"));
        expect(await this.self.totalSupply()).to.be.bignumber.equal(new BN("30000000000000000000000000"));
    });

    it("setOwner()", async function () {
        const role = constants.ZERO_BYTES32;
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(1));
        expectEvent(await this.self.grantRole(role, Malice, {from: caller}),
            "RoleGranted",
            {
                role:    role,
                account: Malice,
                sender:  caller,
            });
        expectEvent(await this.self.revokeRole(role, caller, {from: caller}),
            "RoleRevoked",
            {
                role:    role,
                account: caller,
                sender:  caller,
            });
        expect(await this.self.getRoleMemberCount(role)).to.be.bignumber.equal(new BN(1));
        expect(await this.self.hasRole(role, Malice)).to.be.equal(true);
        expect(await this.self.hasRole(role, caller)).to.be.equal(false);
    });

});
