export function foundryConfiguration(resource:string,deployment:string,base:NodeJS.ProcessEnv=process.env){
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(resource))throw new Error('INVALID_RESOURCE · Enter the Azure resource name by itself, such as my-foundry-resource.');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(deployment))throw new Error('INVALID_DEPLOYMENT · Enter the deployed model name.');
  const environment={...base};
  for(const name of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','ANTHROPIC_FOUNDRY_API_KEY','ANTHROPIC_FOUNDRY_AUTH_TOKEN','ANTHROPIC_FOUNDRY_BASE_URL','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_MANTLE','CLAUDE_CODE_USE_ANTHROPIC_AWS'])delete environment[name];
  environment.CLAUDE_CODE_USE_FOUNDRY='1';
  environment.ANTHROPIC_FOUNDRY_RESOURCE=resource;
  environment.ANTHROPIC_DEFAULT_SONNET_MODEL=deployment;
  environment.AZURE_TOKEN_CREDENTIALS='dev';
  return {environment,summary:{provider:'Microsoft Foundry',resource,deployment,authentication:'Microsoft Entra ID developer credentials',endpoint:`https://${resource}.services.ai.azure.com/anthropic`}};
}
