import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const GITHUB_API = 'https://api.github.com'
const REPO = process.env.GITHUB_REPOSITORY
const TOKEN = process.env.GITHUB_TOKEN

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
        headers: { 'User-Agent': 'BaseDaemon2/1.0 (autonomous agent)' }
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

    default:
      return { error: 'Unknown tool: ' + name }
  }
}
