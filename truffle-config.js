const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
    networks:  {
        kcctestnet: {
            provider:        function () {
                return new HDWalletProvider(process.env.MNEMONIC, "https://rpc-testnet.kcc.network");
            },
            network_id:      322,
            skipDryRun:      true,
            pollingInterval: 60000,
        },
        kccmainnet: {
            provider:        function () {
                return new HDWalletProvider(process.env.MNEMONIC, "https://rpc-mainnet.kcc.network");
            },
            network_id:      321,
            skipDryRun:      true,
            pollingInterval: 60000,
        },
    },
    mocha:     {
        useColors:       true,
        timeout:         10 * 1000,
        slow:            10 * 1000,
        reporter:        "mochawesome",
        reporterOptions: {
            overwrite:      true,
            inline:         true,
            cdn:            true,
            json:           false,
            reportDir:      "doc",
            reportTitle:    "mojito-swap-farm",
            reportFilename: "mojito-swap-farm",
        },
    },
    compilers: {
        solc: {
            version:  "0.6.12",
            settings: {
                optimizer: {
                    enabled: true,
                    runs:    200,
                },
            },
        },
    },
    plugins:   ["solidity-coverage"],
};
