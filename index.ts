import { Telegraf, Context, Markup, session } from 'telegraf';
import dotenv from 'dotenv';
import { job, validators } from './chainwatcher';

// Define the structure for session data
interface SessionData {
  selectedNetwork?: {
    chainId: string;
    api: string;
    name: string;
  };
  retryCount: number;
  lastMessageId?: number; // To store the ID of the last message for deletion
}

// Extend the Context type to include our custom session data
interface MyContext extends Context {
  session: SessionData;
}

// Load environment variables
dotenv.config();

// Start the chain watcher job
job.start();

// Initialize the bot with the token from environment variables
export const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN as string);

// Use session middleware with default session data
bot.use(session({ defaultSession: () => ({
    retryCount: 0,
}) }));

// Define available networks
export const networks = [
  {
    chainId: 'crossfi-mainnet-1',
    api: 'https://crossfi-mainnet-api.itrocket.net',
    name: 'Crossfi Mainnet',
    lastBlockHeight: 0
  },
];

// Handle /start command
bot.command('start', (ctx) => {
  try {
    // Create buttons for each network
    const buttons = networks.map((network) =>
      Markup.button.callback(network.name, `network_${network.chainId}`)
    );
    ctx.reply('Choose a network:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error in start command:', error);
  }
});

// Handle /validators command
bot.command('validators', (ctx) => {
  try {
    // Create buttons for each validator
    const buttons = validators.map((validator) =>
      Markup.button.callback(validator.consensusAddress, `validators_${validator.consensusAddress}`)
    );
    ctx.reply('Choose a Validator:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error in validators command:', error);
  }
});

// Handle validator selection
bot.action(/^validators_/, async (ctx) => {
  try {
    const validatorAddress = ctx.match.input.split('_')[1];
    // Create buttons for validator actions
    const buttons = [
      Markup.button.callback('Info', `valInf_${validatorAddress}`),
      Markup.button.callback('Stop Alerts', `delValTr_${validatorAddress}`),
    ];
    await ctx.editMessageText('What do you want to do:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error in validators_ action:', error);
  }
});

// Handle validator info request
bot.action(/^valInf_/, async (ctx) => {
  try {
    const validatorAddress = ctx.match.input.split('_')[1];
    const response = Object.assign({}, validators.find(v => v.consensusAddress === validatorAddress));
    response.chats = []; // Remove chat IDs for privacy
    await ctx.editMessageText(`Validator Info: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.error('Error in valInf_ action:', error);
  }
});

// Handle stop tracking request
bot.action(/^delValTr_/, async (ctx) => {
  try {
    const validatorAddress = ctx.match.input.split('_')[1];
    const chatValidator = validators.find(v => v.consensusAddress === validatorAddress);
    if (chatValidator) {
      const chatIndex = chatValidator.chats.indexOf(ctx.chat?.id || -1);
      if (chatIndex >= 0) {
        chatValidator.chats.splice(chatIndex, 1);
      }
      // Remove validator if no more chats are tracking it
      if (chatValidator.chats.length === 0) {
        const validatorIndex = validators.findIndex(v => v.consensusAddress === chatValidator.consensusAddress);
        validators.splice(validatorIndex, 1);
      }
      await ctx.editMessageText(`Stopped tracking ${validatorAddress}`);
    }
  } catch (error) {
    console.error('Error in delValTr_ action:', error);
  }
});

// Handle network selection
bot.action(/^network_/, async (ctx) => {
  try {
    const networkId = ctx.match.input.split('_')[1];
    const network = networks.find((n) => n.chainId === networkId);
    if (network) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(`You selected ${network.name}. Please enter a validator address to track:`);
      ctx.session.selectedNetwork = network;
      ctx.session.retryCount = 0;
    }
  } catch (error) {
    console.error('Error in network_ action:', error);
  }
});

// Handle text messages (for validator address input)
bot.on('text', async (ctx) => {
  try {
    if (ctx.session.selectedNetwork) {
      const validatorAddress = ctx.message.text;
      if (validatorAddress.includes('valcons')) {
        // Valid validator address
        await ctx.reply(`The validator ${validatorAddress} is now tracked on ${ctx.session.selectedNetwork.name}.`);
        
        // Add or update validator tracking
        const existingTrackedValidator = validators.find(v => v.consensusAddress === validatorAddress);
        if (existingTrackedValidator) {
          if (!existingTrackedValidator.chats.includes(ctx.message.chat.id)) {
            existingTrackedValidator.chats.push(ctx.message.chat.id);
          }
        } else {
          validators.push({
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
      } else {
        // Invalid validator address
        ctx.session.retryCount++;
        if (ctx.session.retryCount < 3) {
          await ctx.reply('Invalid validator address. Please enter a valid address containing "valcons".');
        } else {
          await ctx.reply('You entered an invalid Valoper-Address too many times. Restart with /start');
          delete ctx.session.selectedNetwork;
          ctx.session.retryCount = 0;
        }
      }
    }
  } catch (error) {
    console.error('Error in text handler:', error);
  }
});

bot.launch();

process.once('SIGINT', () => {
    bot.stop('SIGINT');
    job.stop();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    job.stop();
});
