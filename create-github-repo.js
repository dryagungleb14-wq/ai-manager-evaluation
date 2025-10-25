import { Octokit } from '@octokit/rest';

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function createRepo() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  try {
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: 'ai-manager-evaluation',
      description: 'AI Manager Performance Evaluation Service with PostgreSQL, Gemini API, and Manager Attribution',
      private: false,
      auto_init: false,
    });
    
    console.log('Repository created successfully!');
    console.log('URL:', repo.html_url);
    console.log('Clone URL:', repo.clone_url);
    return repo;
  } catch (error) {
    if (error.status === 422) {
      console.error('Repository already exists');
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

createRepo().catch(console.error);
