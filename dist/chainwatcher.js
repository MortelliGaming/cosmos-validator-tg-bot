"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.job = exports.validators = void 0;
const blockchainhelper_1 = require("./blockchainhelper");
const index_1 = require("./index");
const fs_1 = require("fs");
exports.validators = [];
let intervall = undefined;
exports.job = {
    stop() {
        (0, fs_1.writeFileSync)('./data.json', JSON.stringify(exports.validators));
        clearInterval(intervall);
    },
    start() {
        intervall = setInterval(checkLatestBlockForAllChains, 5000);
        let savedValidators = [];
        if ((0, fs_1.existsSync)('./data.json')) {
            try {
                savedValidators = JSON.parse((0, fs_1.readFileSync)('./data.json', 'utf-8'));
            }
            catch (error) {
                console.error('Error reading or parsing data.json:', error);
                // If there's an error reading or parsing, we'll use an empty array
            }
        }
        exports.validators.push(...savedValidators);
    }
};
async function checkLatestBlockForAllChains() {
    const uniqueChainIds = [...new Set(exports.validators.map(validator => validator.chainId))];
    // check last block on each chain
    for (let chainId of uniqueChainIds) {
        let blockChain = index_1.networks.find(bc => bc.chainId === chainId);
        if (blockChain) {
            try {
                const latestBlockResponse = await (await (0, blockchainhelper_1.GetLatestBlock)(blockChain.api));
                const latestHeight = parseInt(latestBlockResponse.block?.header.height);
                if (latestHeight && latestHeight > blockChain.lastBlockHeight) {
                    let chainId = blockChain.chainId;
                    blockChain.lastBlockHeight = latestHeight;
                    const validatorSet = (await (await (0, blockchainhelper_1.GetValidatorSet)(blockChain.api)));
                    const chainValidators = exports.validators.filter(v => v.chainId === chainId);
                    // alle zu dieser chain gehörenden validators durchgehen
                    for (let validator of chainValidators) {
                        const validatorMissedBlocks = (await (await (0, blockchainhelper_1.GetValidatorSlashingInfos)(blockChain.api, validator.consensusAddress)))?.val_signing_info?.missed_blocks_counter;
                        const validatorVotingPower = validatorSet.validators.find((v) => v.address === validator.consensusAddress)?.voting_power;
                        if (validator.data.missedBlocksInSigningWindow !== Number(validatorMissedBlocks)) {
                            validator.data.missedBlocksInSigningWindow = Number(validatorMissedBlocks);
                            // inform user?!
                            validator.chats.map((c) => {
                                if (validator.data.missedBlocksInSigningWindow.toString() == '0') {
                                    index_1.bot.telegram.sendMessage(c, `INFO(${validator.consensusAddress}): Missed Blocks returned To 0`);
                                }
                                else {
                                    index_1.bot.telegram.sendMessage(c, `INFO (${validator.consensusAddress}): Missed Blocks Count: ${validatorMissedBlocks}`);
                                }
                            });
                        }
                        if (validator.data.votingPower !== validatorVotingPower) {
                            validator.data.votingPower = validatorVotingPower ?? '';
                            // inform user?!
                            validator.chats.map((c) => {
                                index_1.bot.telegram.sendMessage(c, `INFO(${validator.consensusAddress}): New Voting Power: ${validatorVotingPower}`);
                            });
                        }
                    }
                }
            }
            catch {
            }
        }
    }
}
