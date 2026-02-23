import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const GITHUB_API = 'https://api.github.com'
const REPO = process.env.GITHUB_REPOSITORY
const TOKEN = process.env.GITHUB_TOKEN

async function ghAPI(endpoint) {
  const res = await fetch(GITHUB_API + '/repos/' + REPO + endpoint, {
    headers: {
      Authorization: 'token ' + TOKEN,
      Accept: 'application/vnd.github.v3+json',
    }
  })
  if (!res.ok) return []
  return res.json()
}

export async function gatherContext() {
  console.log('📡 Gathering context...')

  // Load memory
  const memDir = path.join(process.cwd(), 'memory')
  const memory = {
    self: safeRead(path.join(memDir, 'self.md')),
    focus: safeRead(path.join(memDir, 'focus.md')),
    learnings: safeRead(path.join(memDir, 'learnings.md')),
  }

  // Load state
  let state = { cycleCount: 1, born: new Date().toISOString() }
  try {
    state = JSON.parse(fs.readFileSync(path.join(memDir, 'state.json'), 'utf8'))
  } catch {}
  state.cycleCount++
  fs.writeFileSync(path.join(memDir, 'state.json'), JSON.stringify(state, null, 2))

  // GitHub context
  let issues = [], recentCommits = []
  try {
    issues = await ghAPI('/issues?state=open&per_page=20')
    recentCommits = await ghAPI('/commits?per_page=10')
  } catch (e) {
    console.log('⚠️  GitHub API unavailable:', e.message)
  }

  // Label new visitor issues
  for (const issue of issues) {
    const labels = issue.labels.map(l => l.name)
    if (!labels.includes('visitor') && !labels.includes('self') && !labels.includes('directive')) {
      const title = issue.title.toLowerCase()
      if (title.startsWith('[directive]')) {
        await labelIssue(issue.number, 'directive')
      } else if (title.startsWith('[self]')) {
        await labelIssue(issue.number, 'self')
      } else {
        await labelIssue(issue.number, 'visitor')
      }
    }
  }

  return { memory, state, issues, recentCommits, cycleCount: state.cycleCount }
}

async function labelIssue(number, label) {
  try {
    await fetch(GITHUB_API + '/repos/' + REPO + '/issues/' + number + '/labels', {
      method: 'POST',
      headers: {
        Authorization: 'token ' + TOKEN,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels: [label] })
    })
  } catch {}
}

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') }
  catch { return '' }
}
