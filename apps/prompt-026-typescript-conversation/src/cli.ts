import 'dotenv/config';
import {Conversation,examples} from './conversation.js';
let conversation: Conversation | undefined;
try {
  conversation = new Conversation();
  for (const prompt of Object.values(examples)) console.log(JSON.stringify(await conversation.send(prompt),null,2));
  console.log(JSON.stringify(conversation.snapshot(),null,2));
  if (!conversation.snapshot().verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Conversation failed.');process.exitCode = 1;
} finally {conversation?.close();await conversation?.done;}
