import { Octokit } from '@octokit/rest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

async function getGitHubClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token;
  return new Octokit({ auth: accessToken });
}

async function pushToGitHub() {
  const octokit = await getGitHubClient();
  const user = await octokit.users.getAuthenticated();
  console.log('Authenticated as:', user.data.login);
  console.log('\nПопытка push через git remote...');
  console.log('Используйте команду в Shell:');
  console.log('\ngit push https://github.com/' + user.data.login + '/ai-manager-evaluation.git main');
}

pushToGitHub().catch(console.error);
