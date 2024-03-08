/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import Gleap from 'react-native-gleapsdk';

const transactionTool = {
    // Name the tool. Only lowecase letters and - are allowed.
    name: 'send-money',
    // Describe the tool. This can also contain further instructions for the LLM.
    description: 'Send money to a given contact.',
    // Let the LLM know what the tool is doing. This will allow Kai to update the customer accordingly.
    response: 'The transfer got initiated but not completed yet. The user must confirm the transfer in the banking app.',
    // Specify the parameters (it's also possible to pass an empty array)
    parameters: [{
        name: 'amount',
        description: 'The amount of money to send. Must be positive and provided by the user.',
        type: 'number',
        required: true
    }, {
        name: 'contact',
        description: 'The contact to send money to.',
        type: 'string',
        enum: ["Alice", "Bob"], // Optional
        required: true
    }]
};

// Add all available tools to the array.
const tools = [transactionTool];

// Set the AI tools.
Gleap.setAiTools(tools);

Gleap.setTicketAttribute("note", "This is a test value.");

Gleap.initialize('rnKAHkPdeQBsRlZ1zh4AfbszdqqxASY0');

Gleap.registerListener('toolExecution', (data) => {
    console.log("data", data);
});

AppRegistry.registerComponent(appName, () => App);
