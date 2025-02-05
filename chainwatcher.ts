import { GetLatestBlock, GetValidatorSet, GetValidatorSlashingInfos } from './blockchainhelper';
import { bot, networks } from './index'
import { writeFileSync, readFileSync, existsSync } from 'fs'


export interface ValidatorData 
{
  consensusAddress: string,
  chainId: string,
  chats: number[],
  data: { missedBlocksInSigningWindow: number, votingPower: string }
}

export const validators = [] as ValidatorData[]

let intervall : NodeJS.Timeout | undefined = undefined;

export const job = {
    stop() {
        writeFileSync('./data.json', JSON.stringify(validators))
        clearInterval(intervall);
    },
    start() {
        intervall = setInterval(checkLatestBlockForAllChains, 5000);
        let savedValidators: any[] = [];
        
        if (existsSync('./data.json')) {
            try {
                savedValidators = JSON.parse(readFileSync('./data.json', 'utf-8'));
            } catch (error) {
                console.error('Error reading or parsing data.json:', error);
                // If there's an error reading or parsing, we'll use an empty array
            }
        } else {
            console.log('data.json does not exist. Starting with an empty validators array.');
        }

        validators.push(...savedValidators);
    }
}

async function checkLatestBlockForAllChains() {
    const uniqueChainIds = [...new Set(validators.map(validator => validator.chainId))];
    // check last block on each chain
    for(let chainId of uniqueChainIds) {
        let blockChain = networks.find(bc => bc.chainId === chainId)
        if(blockChain) {
            try {
                const latestBlockResponse = await (await GetLatestBlock(blockChain.api));
                const latestHeight = parseInt(latestBlockResponse.block?.header.height);
                if(latestHeight && latestHeight > blockChain.lastBlockHeight) {
                    let chainId = blockChain.chainId;
                    blockChain.lastBlockHeight = latestHeight;
                    const validatorSet = (await (await GetValidatorSet(blockChain.api)));
                    const chainValidators = validators.filter(v => v.chainId === chainId);
                    // alle zu dieser chain gehörenden validators durchgehen
                    console.log(chainValidators)
                    for(let validator of chainValidators) {
                        const validatorMissedBlocks = (await (await GetValidatorSlashingInfos(blockChain.api, validator.consensusAddress)))?.val_signing_info?.missed_blocks_counter;
                        console.log(validatorSet)
                        const validatorVotingPower = validatorSet.validators.find((v: any) => v.address === validator.consensusAddress)?.voting_power

                        if(validator.data.missedBlocksInSigningWindow !== Number(validatorMissedBlocks)) {
                            validator.data.missedBlocksInSigningWindow = Number(validatorMissedBlocks);
                            // inform user?!
                            validator.chats.map((c: any) => {
                                if(validator.data.missedBlocksInSigningWindow.toString() == '0') {
                                    bot.telegram.sendMessage(c, `INFO(${validator.consensusAddress}): Missed Blocks returned To 0`)
                                } else {
                                    bot.telegram.sendMessage(c, `INFO (${validator.consensusAddress}): Missed Blocks Count: ${validatorMissedBlocks}`)
                                }
                            })
                        }
                        if(validator.data.votingPower !== validatorVotingPower) {
                            validator.data.votingPower = validatorVotingPower ?? '';
                            // inform user?!
                            validator.chats.map((c: any) => {
                                bot.telegram.sendMessage(c, `INFO(${validator.consensusAddress}): New Voting Power: ${validatorVotingPower}`)
                            })
                        }
                        console.log(validator)
                    }
                }
            } catch {

            }
        }
        
    }
}
