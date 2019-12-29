//  __   __  ___        ___
// |__) /  \  |  |__/ |  |
// |__) \__/  |  |  \ |  |

// This is the main file for the alfred bot.

// Import Botkit's core features
const { Botkit, BotkitConversation } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

//adding axios for API calls
const axios = require('axios');

// Import a platform-specific adapter for web.

const { WebAdapter } = require('botbuilder-adapter-web');

const { MongoDbStorage } = require('botbuilder-storage-mongodb');

// Load process.env values from .env file
require('dotenv').config();

//functions to call API
const callLowerApi = async address => {
  const { data } = await axios.get(
    `https://www.googleapis.com/civicinfo/v2/representatives?key=AIzaSyBavzXMALRjkCfUFxoxRntdDDgtYmtecZs&address=${address}&roles=legislatorLowerBody`
  );
  return data;
};

const callUpperApi = async address => {
  const { data } = await axios.get(
    `https://www.googleapis.com/civicinfo/v2/representatives?key=AIzaSyBavzXMALRjkCfUFxoxRntdDDgtYmtecZs&address=${address}&roles=legislatorUpperBody`
  );

  return data;
};

let storage = null;
if (process.env.MONGO_URI) {
  storage = mongoStorage = new MongoDbStorage({
    url: process.env.MONGO_URI,
  });
}

const adapter = new WebAdapter({});

const controller = new Botkit({
  webhook_uri: '/api/messages',

  adapter: adapter,

  storage,
});

if (process.env.CMS_URI) {
  controller.usePlugin(
    new BotkitCMSHelper({
      uri: process.env.CMS_URI,
      token: process.env.CMS_TOKEN,
    })
  );
}

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {
  // load traditional developer-created local custom feature modules
  controller.loadModules(__dirname + '/features');

  /* catch-all that uses the CMS to trigger dialogs */
  if (controller.plugins.cms) {
    controller.on('message,direct_message', async (bot, message) => {
      let results = false;
      results = await controller.plugins.cms.testTrigger(bot, message);

      if (results !== false) {
        // do not continue middleware!
        return false;
      }
    });
  }
});

//creating a new dialogue
const electedOfficials = new BotkitConversation('electedOfficials', controller);

electedOfficials.say(`Hi there, I'm Alfred the Civic Engagement Bot.`);

electedOfficials.ask(
  `Would you like to look up your state or federal representatives?`,
  [
    {
      pattern: 'state',
      handler: async function(answer, electedOfficials, bot) {
        await electedOfficials.gotoThread('state');
      },
    },
    {
      pattern: 'federal',
      handler: async function(answer, electedOfficials, bot) {
        await electedOfficials.gotoThread('federal');
      },
    },
  ],
  { key: 'officials' }
);

electedOfficials.addMessage(
  'Great, you want to look up your state representatives.',
  'state'
);

electedOfficials.addQuestion(
  'What is your address?',
  async (response, convo, bot) => {
    let lower = await callLowerApi(response);
    let upper = await callUpperApi(response);
    bot.say(`Your state representative is ${lower.officials[1].name}.`);
    bot.say(`Your state senator is ${upper.officials[2].name}.`);
  },
  'address',
  'state'
);

electedOfficials.addMessage(
  'Great, you want to look up your federal representatives.',
  'federal'
);
electedOfficials.addQuestion(
  'What is your address?',
  async (response, convo, bot) => {
    let lower = await callLowerApi(response);
    let upper = await callUpperApi(response);
    bot.say(`Your U.S. representative is ${lower.officials[0].name}.`);
    bot.say(
      `Your senators are ${upper.officials[0].name} and ${upper.officials[1].name}.`
    );
  },
  'address',
  'federal'
);

//adding dialog to controller

controller.addDialog(electedOfficials);

controller.afterDialog(electedOfficials, async (bot, dialog_resuts) => {
  await bot.say(`Thanks for being civically engaged!`);
});

controller.on('message', async (bot, message) => {
  await bot.beginDialog('electedOfficials');
});
