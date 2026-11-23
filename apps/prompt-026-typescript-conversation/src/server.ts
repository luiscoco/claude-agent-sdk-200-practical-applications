import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import 'dotenv/config';
import {Conversation,examples,validateMessage} from './conversation.js';

const root = path.resolve(import.meta.dirname,'..');
const app = express();
const conversations = new Map<string,Conversation>();
app.disable('x-powered-by');
app.use((request,response,next) => {
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.status(403).json({error:'Unexpected request origin.'});return;
  }
  next();
});
app.use(express.json({limit:'16kb'}));
app.use(express.static(path.join(root,'public')));
app.get('/api/examples',(_request,response) => response.json(examples));
async function save(conversation: Conversation, file: string) {
  const snapshot = conversation.snapshot();
  const directory = path.join(root,'runs',snapshot.id);await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,file+'.json'),JSON.stringify(snapshot,null,2));
  return snapshot;
}
app.post('/api/start',async (request,response) => {
  let conversation: Conversation | undefined;
  try {
    const prompt = validateMessage(request.body?.prompt);
    conversations.get(String(request.body?.previousId))?.close('A new conversation was started.');
    conversation = new Conversation();conversations.set(conversation.id,conversation);
    const turn = await conversation.send(prompt);
    response.json({conversation:await save(conversation,turn.id),turn});
  } catch (error) {
    conversation?.close('The initial message failed.');
    response.status(422).json({error:error instanceof Error ? error.message : 'Conversation startup failed.'});
  }
});
app.post('/api/send/:id',async (request,response) => {
  const conversation = conversations.get(String(request.params.id));
  if (!conversation) {response.status(404).json({error:'CONVERSATION_NOT_FOUND · Start a new conversation.'});return;}
  try {
    const turn = await conversation.send(request.body?.prompt);
    response.json({conversation:await save(conversation,turn.id),turn});
  } catch (error) {response.status(422).json({error:error instanceof Error ? error.message : 'Message failed.'});}
});
app.post('/api/close/:id',async (request,response) => {
  const conversation = conversations.get(String(request.params.id));
  if (!conversation) {response.status(404).json({error:'Conversation not found.'});return;}
  conversation.close();await conversation.done;
  response.json(await save(conversation,'closed'));
});
app.get('/api/conversation/:id',(request,response) => {
  const conversation = conversations.get(String(request.params.id));
  if (!conversation) {response.status(404).json({error:'Conversation not found.'});return;}
  response.json(conversation.snapshot());
});
app.get('/api/report/:id',(request,response) => {
  const conversation = conversations.get(String(request.params.id));
  if (!conversation) {response.status(404).end();return;}
  response.attachment('typescript-conversation-report.json').json(conversation.snapshot());
});
const sources = ['src/queue.ts','src/conversation.ts','src/server.ts','src/cli.ts'];
app.get('/api/source',async (request,response) => {
  const file = String(request.query.file || sources[0]);if (!sources.includes(file)) {response.status(404).end();return;}
  response.json({file,files:sources,content:await readFile(path.join(root,file),'utf8')});
});
const port = Number(process.env.PORT || 43126);
const server = app.listen(port,'127.0.0.1',() => console.log(`Prompt 26 lab http://127.0.0.1:${port}`));
async function shutdown() {
  for (const conversation of conversations.values()) conversation.close('The lab server stopped.');
  await Promise.allSettled([...conversations.values()].map(conversation => conversation.done));
  server.close();
}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
