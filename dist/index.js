"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networks = exports.bot = void 0;
const telegraf_1 = require("telegraf");
const dotenv_1 = require("dotenv");
const chainwatcher_1 = require("./chainwatcher");
// Load environment variables
(0, dotenv_1.config)();
// Start the chain watcher job
chainwatcher_1.job.start();
// Initialize the bot with the token from environment variables
exports.bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
// Use session middleware with default session data
exports.bot.use((0, telegraf_1.session)({ defaultSession: () => ({
        retryCount: 0,
    }) }));
// Define available networks
exports.networks = [
    {
        chainId: 'crossfi-mainnet-1',
        api: 'https://crossfi-mainnet-api.itrocket.net',
        name: 'Crossfi Mainnet',
        lastBlockHeight: 0
    },
];
// Handle /start command
exports.bot.command('start', (ctx) => {
    try {
        // Create buttons for each network
        const buttons = exports.networks.map((network) => telegraf_1.Markup.button.callback(network.name, `network_${network.chainId}`));
        ctx.reply('Choose a network:', telegraf_1.Markup.inlineKeyboard(buttons));
    }
    catch (error) {
        console.error('Error in start command:', error);
    }
});
// Handle /validators command
exports.bot.command('validators', (ctx) => {
    try {
        // Create buttons for each validator
        const buttons = chainwatcher_1.validators.map((validator) => telegraf_1.Markup.button.callback(validator.consensusAddress, `validators_${validator.consensusAddress}`));
        ctx.reply('Choose a Validator:', telegraf_1.Markup.inlineKeyboard(buttons));
    }
    catch (error) {
        console.error('Error in validators command:', error);
    }
});
// Handle validator selection
exports.bot.action(/^validators_/, async (ctx) => {
    try {
        const validatorAddress = ctx.match.input.split('_')[1];
        // Create buttons for validator actions
        const buttons = [
            telegraf_1.Markup.button.callback('Info', `valInf_${validatorAddress}`),
            telegraf_1.Markup.button.callback('Stop Alerts', `delValTr_${validatorAddress}`),
        ];
        await ctx.editMessageText('What do you want to do:', telegraf_1.Markup.inlineKeyboard(buttons));
    }
    catch (error) {
        console.error('Error in validators_ action:', error);
    }
});
// Handle validator info request
exports.bot.action(/^valInf_/, async (ctx) => {
    try {
        const validatorAddress = ctx.match.input.split('_')[1];
        const response = Object.assign({}, chainwatcher_1.validators.find(v => v.consensusAddress === validatorAddress));
        response.chats = []; // Remove chat IDs for privacy
        await ctx.editMessageText(`Validator Info: ${JSON.stringify(response, null, 2)}`);
    }
    catch (error) {
        console.error('Error in valInf_ action:', error);
    }
});
// Handle stop tracking request
exports.bot.action(/^delValTr_/, async (ctx) => {
    try {
        const validatorAddress = ctx.match.input.split('_')[1];
        const chatValidator = chainwatcher_1.validators.find(v => v.consensusAddress === validatorAddress);
        if (chatValidator) {
            const chatIndex = chatValidator.chats.indexOf(ctx.chat?.id || -1);
            if (chatIndex >= 0) {
                chatValidator.chats.splice(chatIndex, 1);
            }
            // Remove validator if no more chats are tracking it
            if (chatValidator.chats.length === 0) {
                const validatorIndex = chainwatcher_1.validators.findIndex(v => v.consensusAddress === chatValidator.consensusAddress);
                chainwatcher_1.validators.splice(validatorIndex, 1);
            }
            await ctx.editMessageText(`Stopped tracking ${validatorAddress}`);
        }
    }
    catch (error) {
        console.error('Error in delValTr_ action:', error);
    }
});
// Handle network selection
exports.bot.action(/^network_/, async (ctx) => {
    try {
        const networkId = ctx.match.input.split('_')[1];
        const network = exports.networks.find((n) => n.chainId === networkId);
        if (network) {
            await ctx.answerCbQuery();
            await ctx.editMessageText(`You selected ${network.name}. Please enter a validator address to track:`);
            ctx.session.selectedNetwork = network;
            ctx.session.retryCount = 0;
        }
    }
    catch (error) {
        console.error('Error in network_ action:', error);
    }
});
// Handle text messages (for validator address input)
exports.bot.on('text', async (ctx) => {
    try {
        if (ctx.session.selectedNetwork) {
            const validatorAddress = ctx.message.text;
            if (validatorAddress.includes('valcons')) {
                // Valid validator address
                await ctx.reply(`The validator ${validatorAddress} is now tracked on ${ctx.session.selectedNetwork.name}.`);
                // Add or update validator tracking
                const existingTrackedValidator = chainwatcher_1.validators.find(v => v.consensusAddress === validatorAddress);
                if (existingTrackedValidator) {
                    if (!existingTrackedValidator.chats.includes(ctx.message.chat.id)) {
                        existingTrackedValidator.chats.push(ctx.message.chat.id);
                    }
                }
                else {
                    chainwatcher_1.validators.push({
                        consensusAddress: validatorAddress,
                        chainId: ctx.session.selectedNetwork.chainId,
                        chats: [ctx.message.chat.id],
                        data: {
                            missedBlocksInSigningWindow: 0,
                            votingPower: '0',
                        },
                    });
                }
                // Delete the user's message containing the validator address
                if (ctx.message.message_id) {
                    await ctx.deleteMessage(ctx.message.message_id).catch(error => {
                        console.error('Failed to delete message:', error);
                    });
                }
                // Reset session
                delete ctx.session.selectedNetwork;
                ctx.session.retryCount = 0;
            }
            else {
                // Invalid validator address
                ctx.session.retryCount++;
                if (ctx.session.retryCount < 3) {
                    await ctx.reply('Invalid validator address. Please enter a valid address containing "valcons".');
                }
                else {
                    await ctx.reply('You entered an invalid Valoper-Address too many times. Restart with /start');
                    delete ctx.session.selectedNetwork;
                    ctx.session.retryCount = 0;
                }
            }
        }
    }
    catch (error) {
        console.error('Error in text handler:', error);
    }
});
exports.bot.launch();
process.once('SIGINT', () => {
    exports.bot.stop('SIGINT');
    chainwatcher_1.job.stop();
});
process.once('SIGTERM', () => {
    exports.bot.stop('SIGTERM');
    chainwatcher_1.job.stop();
});
