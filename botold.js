// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// bot.js is your main bot dialog entry point for handling activity types

// Import required Bot Builder
const {
    ActivityTypes,
    CardFactory
} = require('botbuilder');
const {
    LuisRecognizer
} = require('botbuilder-ai');
const axios = require('axios');
const {
    DialogSet,
    TextPrompt,
    ChoicePrompt,
    ConfirmPrompt,
    DatetimePrompt,
    FoundChoice,
    FoundDatetime,
    ListStyle, 
    WaterfallDialog
} = require('botbuilder-dialogs');


const {
    WelcomeCard
} = require('./welcomeCard');

// LUIS service type entry as defined in the .bot file.
const LUIS_CONFIGURATION = 'BasicBotLuisApplication';

// Supported LUIS Intents.
const GREETING_INTENT = 'Greeting';
const CANCEL_INTENT = 'Cancel';
const HELP_INTENT = 'Help';
const NONE_INTENT = 'None';
const CHECKACCOUNT_INTENT = "checkAccount";

// persistent state properties
const DIALOG_STATE_PROPERTY = 'dialogState';
const USER_NAME_PROP = 'user_name';

// dialog references
const WHO_ARE_YOU = 'who_are_you';
const HELLO_USER = 'hello_user';
const NAME_PROMPT = 'name_prompt';

// dialogs



/**
 * Demonstrates the following concepts:
 *  Displaying a Welcome Card, using Adaptive Card technology
 *  Use LUIS to model Greetings, Help, and Cancel interactions
 */
class BasicBot {
    /**
     * Constructs the necessary pieces for this bot to operate:
     * 1. LUIS client
     *
     * @param {BotConfiguration} botConfig contents of the .bot file
     * @param {Object} conversationState state store for the conversation (ACCESSOR)
     * @param {Object} userState private state store per user (ACCESSOR)
     */
    constructor(botConfig, conversationState, userState) {
        // creates a new state accessor property. see https://aka.ms/about-bot-state-accessors to learn more about the bot state and state accessors
        this.conversationState = conversationState;
        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.userState = userState;
        this.userName = this.userState.createProperty(USER_NAME_PROP);

        this.dialogs = new DialogSet(this.dialogState);
        this.dialogs.add(new TextPrompt(NAME_PROMPT)); // TODO: refactor in own pages - per dialog subject (intent)

        // Create a dialog that asks the user for their name.
        this.dialogs.add(new WaterfallDialog(WHO_ARE_YOU, [
            this.askForName.bind(this),
            this.collectAndDisplayName.bind(this)
        ]));
        this.dialogs.add(new WaterfallDialog(HELLO_USER, [
            this.displayName.bind(this)
        ]));

        if (!botConfig) throw ('Missing parameter.  botConfig is required');
        // Add the LUIS recognizer.
        const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION);
        if (!luisConfig || !luisConfig.appId) throw ('Missing LUIS configuration. Please follow README.MD to create required LUIS applications.\n\n');
        this.luisRecognizer = new LuisRecognizer({
            applicationId: "4576b202-e5a9-4e2b-9b19-961ac2a0e831",
            endpoint: "https://westeurope.api.cognitive.microsoft.com/luis/v2.0/apps/4576b202-e5a9-4e2b-9b19-961ac2a0e831?subscription-key=cbcdfd8ed0d14d48ae3b01dd8c739bbf&timezoneOffset=60&q=",
            endpointKey: "cbcdfd8ed0d14d48ae3b01dd8c739bbf"
        });
    }

    async askForName(dc, step) {
       // return dc.prompt()
        return await dc.prompt(NAME_PROMPT, `What is your name, human?`);
        
    }
    // The second step in this waterfall collects the response, stores it in
    // the state accessor, then displays it.
    async collectAndDisplayName(step) {
        await this.userName.set(step.context, step.result);
        await step.context.sendActivity(`Got it. You are ${ step.result }.`);
        return await step.endDialog();
    }
    // This step loads the user's name from state and displays it.
    async displayName(step) {
        const userName = await this.userName.get(step.context, null);
        await step.context.sendActivity(`Your name is ${ userName }.`);
        return await step.endDialog();
    }


    /**
     * Driver code that does one of the following:
     * 1. Use LUIS to recognize intents for incoming user message
     *
     * @param {Context} context turn context from the adapter
     */
    async onTurn(context) {
        // Handle Message activity type, which is the main activity type for shown within a conversational interface
        // Message activities may contain text, speech, interactive cards, and binary or unknown attachments.
        // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types        
        const dc = await this.dialogs.createContext(context);
        if (context.activity.type === ActivityTypes.Message) {

            

            // Create dialog context
            
            // Perform a call to LUIS to retrieve results for the current activity message.
            const results = await this.luisRecognizer.recognize(context);
            
            const topIntent = LuisRecognizer.topIntent(results);
            // const utterance = (turnContext.activity.text || '').trim().toLowerCase();
            
            // // Continue the current dialog
            //  if (!context.responded) {
            //     await dc.continueDialog();
            // }

            // Show menu if no response sent
            // if (!context.responded) {
            //     var userName = await this.userName.get(dc.context, null);
            //     if (userName) {
            //         await dc.beginDialog(HELLO_USER);
            //     } else {
            //         await dc.beginDialog(WHO_ARE_YOU);
            //     }
            // }

            switch (topIntent) {
                case CHECKACCOUNT_INTENT:
                    // let account = entities[0];
                    let accountLabel = results.entities["Account"];
                    if (accountLabel === undefined) {
                        // ask with dialogprompt

                        await context.sendActivity(`no accountlabel is defined`);
                    }
                    if (accountLabel !== undefined) {
                        let url = `https://nestjsbackend.herokuapp.com/accounts/${accountLabel}`;
                        const res = await axios.get(url);
                        const amountLeft = res.data;
                        await context.sendActivity(`The balance of ${accountLabel} is ${amountLeft}`);
                    }


                    break;
                case GREETING_INTENT:
                    await context.sendActivity(`Hello.`);
                    break;
                case HELP_INTENT:
                    await context.sendActivity(`Let me try to provide some help.`);
                    await context.sendActivity(`I understand greetings, being asked for help, or being asked to cancel what I am doing.`);
                    break;
                case CANCEL_INTENT:
                    await context.sendActivity(`I have nothing to cancel.`);
                    break;
                case NONE_INTENT:
                default:
                    // None or no intent identified, either way, let's provide some help
                    // to the user
                    await context.sendActivity(`I didn't understand what you just said to me.`);
                    break;
            }

        }
        // Handle ConversationUpdate activity type, which is used to indicates new members add to 
        // the conversation. 
        // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types
        else if (context.activity.type === ActivityTypes.ConversationUpdate) {
            // Do we have any new members added to the conversation?
            if (context.activity.membersAdded.length !== 0) {
                // Iterate over all new members added to the conversation
                for (var idx in context.activity.membersAdded) {
                    // Greet anyone that was not the target (recipient) of this message
                    // the 'bot' is the recipient for events from the channel,
                    // context.activity.membersAdded == context.activity.recipient.Id indicates the
                    // bot was added to the conversation.
                    if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) {
                        // Welcome user.
                        // When activity type is "conversationUpdate" and the member joining the conversation is the bot
                        // we will send our Welcome Adaptive Card.  This will only be sent once, when the Bot joins conversation
                        // To learn more about Adaptive Cards, see https://aka.ms/msbot-adaptivecards for more details.
                        // const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
                        //  await context.sendActivity({
                        //      attachments: [welcomeCard]
                        //  });
                        await dc.beginDialog(WHO_ARE_YOU);


                    }
                }
            }
        }
        // Save changes to the user name.
        await this.userState.saveChanges(context);

        // End this turn by saving changes to the conversation state.
        await this.conversationState.saveChanges(context);
    }
}



// dialogs.add('BalanceDialog', [
//     async function(dc){
//         let balance = Math.floor(Math.random() * Math.floor(100));
//         await dc.context.sendActivity(`Your balance is £${balance}.`);
//         await dc.continue();
//     },
//     async function(dc){
//         await dc.context.sendActivity(`OK, we're done here. What is next?`);
//         await dc.continue();
//     },
//     async function(dc){
//         await dc.end();
//     }
// ]);

// dialogs.add('TransferDialog', [
//     async function(dc) {
//         const state = convoState.get(dc.context);
//         if (state.AccountLabel) {
//             await dc.continue();
//         } else {
//             await dc.prompt('textPrompt', `Which account do you want to transfer from? For example Joint, Current, Savings etc`);
//         }
//     },
//     async function(dc, accountLabel) {
//         const state = convoState.get(dc.context);
//         // Save accountLabel
//         if (!state.AccountLabel) {
//             state.AccountLabel = accountLabel;
//         }

//         //continue
//         await dc.continue();
//     },
//     async function(dc) {
//         const state = convoState.get(dc.context);
//         await dc.context.sendActivity(`AccountLabel: ${state.AccountLabel}`);

//         //continue
//         await dc.continue();
//     },    
//     async function(dc){
//         await dc.context.sendActivity(`OK, we're done here. What is next?`);
//         await dc.continue();
//     },
//     async function(dc){
//         await dc.end();
//     }
// ]);

//module.exports.BasicBot = BasicBot