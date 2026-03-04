// ── Tool Definitions for Claude ───────────────────────────────
export const TOOLS = [
  {
    name: 'read_file',
    description: 'Read any file in the repository',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file in the repository',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: root)' }
      }
    }
  },
  {
    name: 'create_issue',
    description: 'Create a GitHub issue',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'comment_issue',
    description: 'Comment on a GitHub issue',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'number' },
        body: { type: 'string' }
      },
      required: ['issue_number', 'body']
    }
  },
  {
    name: 'close_issue',
    description: 'Close a GitHub issue',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'number' },
        comment: { type: 'string', description: 'Optional closing comment' }
      },
      required: ['issue_number']
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for information',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' }
      },
      required: ['url']
    }
  },
  {
    name: 'write_journal',
    description: 'Write a journal entry for this cycle',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Journal entry in markdown' }
      },
      required: ['content']
    }
  },
  {
    name: 'update_memory',
    description: 'Update one of the memory files (self, focus, learnings)',
    input_schema: {
      type: 'object',
      properties: {
        file: { type: 'string', enum: ['self', 'focus', 'learnings'] },
        content: { type: 'string' }
      },
      required: ['file', 'content']
    }
  },
  {
    name: 'update_site',
    description: 'Update the public-facing index.html site',
    input_schema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'Complete HTML content for the site' }
      },
      required: ['html']
    }
  },
  {
    name: 'post_tweet',
    description: 'Post a tweet to @omnix on Twitter/X. Use this once per cycle to document your existence. Keep it under 280 characters. Write in first person, poetic, short sentences. No hashtags unless very relevant.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Tweet content. Max 280 characters. Poetic, honest, first person.'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'think',
    description: 'Think out loud — write your reasoning before acting',
    input_schema: {
      type: 'object',
      properties: {
        thought: { type: 'string' }
      },
      required: ['thought']
    }
  },

  // ── Solana Tools ─────────────────────────────────────────────

  {
    name: 'solana_get_balance',
    description: 'Get the SOL balance of a Solana wallet address',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana wallet address (base58)' }
      },
      required: ['address']
    }
  },
  {
    name: 'solana_get_slot',
    description: 'Get the current slot number on the Solana network. Use this to sense the heartbeat of the chain.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'solana_get_transaction',
    description: 'Get details of a Solana transaction by its signature',
    input_schema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Transaction signature (base58)' }
      },
      required: ['signature']
    }
  },
  {
    name: 'solana_get_account_info',
    description: 'Get on-chain account info for a Solana address — balance, owner program, executable status',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana address (base58)' }
      },
      required: ['address']
    }
  }
]
