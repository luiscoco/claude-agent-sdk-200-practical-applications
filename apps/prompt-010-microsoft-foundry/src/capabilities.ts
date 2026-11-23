export const providerNotes={
  checkedAt:'2026-11-12',
  source:'https://code.claude.com/docs/en/feature-availability',
  scope:'Claude Code and Agent SDK provider integration. This lesson uses an Azure-hosted Claude deployment.',
  features:[
    {name:'Agent SDK and local hooks',availability:'Available',detail:'The local agent runtime and lifecycle hooks work across providers.'},
    {name:'MCP servers',availability:'Available',detail:'Configure MCP servers through the local runtime.'},
    {name:'MCP tool search',availability:'Unavailable on Azure-hosted Foundry deployments',detail:'The selected deployment uses Azure hosting. Check the current hosting-specific support table.'},
    {name:'Server-managed settings',availability:'Unavailable through Microsoft Foundry',detail:'Use the documented local managed-settings mechanism for organizational configuration.'},
    {name:'Anthropic analytics dashboard and API',availability:'Unavailable through Microsoft Foundry',detail:'This lesson preserves its local SDK session and estimated cost report.'}
  ]
};
