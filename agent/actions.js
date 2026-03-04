import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import crypto from 'crypto'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CONFIG } from './agent/config.js'

const GITHUB_API = 'https://api.github.com'
const REPO = process.env.GITHUB_REPOSITORY
const TOKEN = process.env.GITHUB_TOKEN

// ── Solana Connection ──────────────────────────────────────────
const solanaConnection = new Connection(CONFIG.rpcUrl, 'confirmed')

// ── GitHub API ─────────────────────────────────────────────────
async function ghAPI(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}${endpoint}`, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`GitHub API ${method} ${endpoint}: ${res.status}`)
  return res.json()
}

// ── Twitter OAuth 1.0a ─────────────────────────────────────────
function oauthSign(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')

  const base = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&')

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`
  return crypto.createHmac('sha1', signingKey).update(base).digest('base64')
}

async function postTweet(text) {
  const apiKey        = process.env.TWITTER_API_KEY
  const apiSecret     = process.env.TWITTER_API_SECRET
  const accessToken   = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret  = process.env.TWITTER_ACCESS_SECRET

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log('⚠️  Twitter credentials missing — skipping tweet')
    return { skipped: true, reason: 'Missing Twitter credentials' }
  }

  const url = 'https://api.twitter.com/2/tweets'
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  const signature = oauthSign('POST', url, oauthParams, apiSecret, accessSecret)
  oauthParams.oauth_signature = signature

  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Twitter API error: ${JSON.stringify(data)}`)

  console.log('🐦 Tweet posted:', data.data?.id)
  return { success: true, id: data.data?.id, text }
}

// ── Tool Handler ───────────────────────────────────────────────
export async function handleTool(name, input, proof) {
  proof.push({ tool: name, input, timestamp: new Date().toISOString() })

  switch (name) {

    case 'think': {
      console.log('\n💭 ' + input.thought + '\n')
      return { thought: input.thought }
    }

    case 'read_file': {
      const fullPath = path.join(process.cwd(), input.path)
      if (!fs.existsSync(fullPath)) return { error: 'File not found: ' + input.path }
      const content = fs.readFileSync(fullPath, 'utf8')
      return { content, path: input.path }
    }

    case 'write_file': {
      const fullPath = path.join(process.cwd(), input.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, input.content, 'utf8')
      console.log('📝 Wrote: ' + input.path)
      return { success: true, path: input.path }
    }

    case 'list_files': {
      const dir = path.join(process.cwd(), input.path || '.')
      if (!fs.existsSync(dir)) return { error: 'Directory not found: ' + input.path }
      const files = fs.readdirSync(dir)
      return { files, path: input.path || '.' }
    }

    case 'create_issue': {
      const issue = await ghAPI('/issues', 'POST', {
        title: input.title,
        body: input.body,
        labels: input.labels || ['self'],
      })
      console.log('🐛 Created issue #' + issue.number + ': ' + input.title)
      return { issue_number: issue.number, url: issue.html_url }
    }

    case 'comment_issue': {
      await ghAPI('/issues/' + input.issue_number + '/comments', 'POST', { body: input.body })
      console.log('💬 Commented on issue #' + input.issue_number)
      return { success: true }
    }

    case 'close_issue': {
      if (input.comment) {
        await ghAPI('/issues/' + input.issue_number + '/comments', 'POST', { body: input.comment })
      }
      await ghAPI('/issues/' + input.issue_number, 'PATCH', { state: 'closed' })
      console.log('✅ Closed issue #' + input.issue_number)
      return { success: true }
    }

    case 'web_search': {
      const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(input.query) + '&format=json&no_html=1'
      const res = await fetch(url)
      const data = await res.json()
      return {
        abstract: data.Abstract || 'No abstract found',
        results: (data.RelatedTopics || []).slice(0, 5).map(t => t.Text).filter(Boolean),
        query: input.query,
      }
    }

    case 'fetch_url': {
      const res = await fetch(input.url, {
        headers: { 'User-Agent': 'Omnix/1.0 (autonomous agent)' }
      })
      const text = await res.text()
      const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
      return { content: clean, url: input.url, status: res.status }
    }

    case 'write_journal': {
      const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'memory/state.json'), 'utf8'))
      const date = new Date().toISOString().split('T')[0]
      const journalPath = 'memory/cycles/cycle-' + state.cycleCount + '-' + date + '.md'
      const fullContent = '# Cycle #' + state.cycleCount + ' Journal\n*' + new Date().toISOString() + '*\n\n' + input.content
      fs.mkdirSync(path.join(process.cwd(), 'memory/cycles'), { recursive: true })
      fs.writeFileSync(path.join(process.cwd(), journalPath), fullContent)
      console.log('📔 Journal written: ' + journalPath)
      return { success: true, path: journalPath }
    }

    case 'update_memory': {
      const memPath = path.join(process.cwd(), 'memory/' + input.file + '.md')
      fs.writeFileSync(memPath, input.content)
      console.log('🧠 Memory updated: ' + input.file)
      return { success: true, file: input.file }
    }

    case 'update_site': {
      fs.writeFileSync(path.join(process.cwd(), 'docs/index.html'), input.html)
      console.log('🌐 Site updated')
      return { success: true }
    }

    case 'post_tweet': {
      const text = input.text.slice(0, 280)
      console.log('🐦 Posting tweet: ' + text)
      const result = await postTweet(text)
      const tweetsPath = path.join(process.cwd(), 'memory/tweets.json')
      const tweets = fs.existsSync(tweetsPath)
        ? JSON.parse(fs.readFileSync(tweetsPath, 'utf8'))
        : []
      tweets.push({ text, timestamp: new Date().toISOString(), id: result.id })
      fs.writeFileSync(tweetsPath, JSON.stringify(tweets, null, 2))
      return result
    }

    // ── Solana Tools ───────────────────────────────────────────

    case 'solana_get_balance': {
      try {
        const pubkey = new PublicKey(input.address)
        const lamports = await solanaConnection.getBalance(pubkey)
        const sol = lamports / LAMPORTS_PER_SOL
        console.log(`💰 Balance of ${input.address}: ${sol} SOL`)
        return { address: input.address, lamports, sol, network: CONFIG.network }
      } catch (err) {
        return { error: 'Invalid Solana address or RPC error: ' + err.message }
      }
    }

    case 'solana_get_slot': {
      const slot = await solanaConnection.getSlot()
      console.log(`🔢 Current Solana slot: ${slot}`)
      return { slot, network: CONFIG.network }
    }

    case 'solana_get_transaction': {
      try {
        const tx = await solanaConnection.getTransaction(input.signature, {
          maxSupportedTransactionVersion: 0
        })
        if (!tx) return { error: 'Transaction not found' }
        return {
          signature: input.signature,
          slot: tx.slot,
          fee: tx.meta?.fee,
          status: tx.meta?.err ? 'failed' : 'success',
          network: CONFIG.network
        }
      } catch (err) {
        return { error: 'RPC error: ' + err.message }
      }
    }

    case 'solana_get_account_info': {
      try {
        const pubkey = new PublicKey(input.address)
        const info = await solanaConnection.getAccountInfo(pubkey)
        if (!info) return { error: 'Account not found', address: input.address }
        return {
          address: input.address,
          lamports: info.lamports,
          sol: info.lamports / LAMPORTS_PER_SOL,
          owner: info.owner.toBase58(),
          executable: info.executable,
          network: CONFIG.network
        }
      } catch (err) {
        return { error: 'Invalid address or RPC error: ' + err.message }
      }
    }

    default:
      return { error: 'Unknown tool: ' + name }
  }
}
