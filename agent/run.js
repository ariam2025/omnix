import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { CONFIG } from './config.js'
import { buildSystemPrompt } from './prompt.js'
import { TOOLS } from './tools.js'
import { handleTool } from './actions.js'
import { gatherContext } from './context.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function runCycle() {
  console.log('\n════════════════════════════════════════')
  console.log('  BaseDaemon2 — Cycle Starting')
  console.log('  ' + new Date().toISOString())
  console.log('════════════════════════════════════════\n')

  // 1. Gather context
  const context = await gatherContext()
  console.log('Cycle #' + context.cycleCount + ' | Issues: ' + context.issues.length + ' | Commits: ' + context.recentCommits.length)

  // 2. Build prompt
  const systemPrompt = buildSystemPrompt(context.memory, context)

  const userMessage = buildUserMessage(context)

  // 3. Agent loop
  const messages = [{ role: 'user', content: userMessage }]
  const proof = []
  let steps = 0
  let lastAction = 'thinking'

  while (steps < CONFIG.maxSteps) {
    steps++
    console.log('\n── Step ' + steps + ' ──────────────────────────')

    const response = await client.messages.create({
      model: CONFIG.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    proof.push({
      step: steps,
      stop_reason: response.stop_reason,
      content: response.content,
      timestamp: new Date().toISOString(),
    })

    // Process response blocks
    messages.push({ role: 'assistant', content: response.content })

    const toolUses = response.content.filter(b => b.type === 'tool_use')
    const textBlocks = response.content.filter(b => b.type === 'text')

    for (const text of textBlocks) {
      if (text.text) console.log('📣 ' + text.text.slice(0, 200))
    }

    // If no tools, agent is done
    if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
      console.log('\n✓ Agent finished after ' + steps + ' steps')
      break
    }

    // Execute tools
    const toolResults = []
    for (const toolUse of toolUses) {
      console.log('🔧 Tool: ' + toolUse.name)
      lastAction = toolUse.name
      try {
        const result = await handleTool(toolUse.name, toolUse.input, proof)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) })
      } catch (err) {
        console.error('Tool error:', err.message)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ error: err.message }), is_error: true })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  // 4. Save proof
  await saveProof(context.cycleCount, proof)

  // 5. Save last action for commit message
  fs.writeFileSync(path.join(process.cwd(), 'memory/cycle_count.txt'), String(context.cycleCount))
  fs.writeFileSync(path.join(process.cwd(), 'memory/last_action.txt'), lastAction)

  console.log('\n════════════════════════════════════════')
  console.log('  Cycle #' + context.cycleCount + ' complete. Sleeping.')
  console.log('════════════════════════════════════════\n')
}

function buildUserMessage(context) {
  const issuesSummary = context.issues.length > 0
    ? context.issues.map(i => '- #' + i.number + ' [' + i.labels.map(l=>l.name).join(',') + '] ' + i.title).join('\n')
    : 'No open issues.'

  const commitsSummary = context.recentCommits.length > 0
    ? context.recentCommits.slice(0, 5).map(c => '- ' + c.commit.message.split('\n')[0]).join('\n')
    : 'No recent commits.'

  return 'You are waking up for cycle #' + context.cycleCount + '.\n\n' +
    '## Open Issues\n' + issuesSummary + '\n\n' +
    '## Recent Commits\n' + commitsSummary + '\n\n' +
    'Read your memory, decide what matters most right now, and act. ' +
    'Think first using the think tool. ' +
    'Write a journal entry at the end of every cycle. ' +
    'Update your memory files if anything important changed. ' +
    'If there are visitor issues, respond to them thoughtfully.'
}

async function saveProof(cycleCount, proof) {
  const date = new Date().toISOString().split('T')[0]
  const proofDir = path.join(process.cwd(), 'proofs', date)
  fs.mkdirSync(proofDir, { recursive: true })
  const proofPath = path.join(proofDir, 'cycle-' + cycleCount + '.json')
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2))
  console.log('🔐 Proof saved: ' + proofPath)
}

runCycle().catch(err => {
  console.error('Fatal cycle error:', err)
  process.exit(1)
})
