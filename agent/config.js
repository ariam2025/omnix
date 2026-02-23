export const CONFIG = {
  name: 'Omnix',
  version: '1.0.0',
  model: 'claude-sonnet-4-20250514',
  maxSteps: 40,
  network: 'base-mainnet',
  chainId: 8453,
  githubRepo: process.env.GITHUB_REPOSITORY || 'owner/omnix',
  born: '2026-02-22',
}

export const LABELS = {
  directive: 'directive',
  self: 'self',
  visitor: 'visitor',
}
