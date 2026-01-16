# Browser Canvas Promotion Plan

A tactical plan for growing awareness and adoption of Browser Canvas.

## Current State

**What it is**: Claude Code plugin that renders React UIs via file operations. Write `App.jsx` → browser opens → hot reload on edit.

**Target audience**: Claude Code users who want visual interfaces for their AI workflows.

**Key differentiators**:
- File-based protocol (no API, no special SDK)
- Pre-bundled shadcn/ui + Recharts components
- Two-way state sync between agent and UI
- Screenshots and event capture built-in

## Phase 1: Foundation (Immediate)

### README Optimization

The current README is solid but can improve:

| Current | Improvement |
|---------|-------------|
| Hero image exists | Add GIF showing write → render → interact flow |
| Installation clear | Add "Try it in 30 seconds" section at very top |
| Features table | Add comparison table vs alternatives |

**Action items**:
1. Create a 10-second GIF demo showing: create file → browser opens → edit → hot reload
2. Add "30-second try" section before Quick Start with single copy-paste command
3. Add "Why Browser Canvas?" section explaining file-based vs API-based approaches

### Social Proof

- [ ] Add star count badge
- [ ] Add "Used by" section (even if just your own projects initially)
- [ ] Document 2-3 real use cases as examples

## Phase 2: Launch Announcements

### Primary Channels

| Platform | Timing | Content Type |
|----------|--------|--------------|
| **Twitter/X** | Day 1 | Thread with GIF demo |
| **r/ClaudeAI** | Day 1 | Post explaining the problem it solves |
| **Hacker News** | Day 2 | Show HN post (after some Reddit discussion) |
| **Claude Code Discord** | Day 1 | Share in appropriate channel |

### Twitter/X Thread Template

```
1/ Shipped Browser Canvas - a Claude Code plugin that lets Claude create UIs just by writing files.

No APIs. No protocols. Just write App.jsx and watch it render.

[GIF of it working]

2/ The problem: Claude can write code, but can't see what it builds.

Browser Canvas gives Claude eyes:
- Write JSX → browser opens
- Edit → hot reload
- Read events.jsonl → see what users clicked
- Screenshot → verify rendering

3/ Everything is pre-bundled:
- shadcn/ui components
- Recharts for data viz
- Tailwind CSS
- useState, useEffect, etc.

Claude doesn't need imports. Just writes a function and it runs.

4/ Two-way state sync means Claude can:
- Push data to the UI via _state.json
- Read user input back
- React to button clicks

It's like giving Claude a React playground.

5/ Try it:
/plugin install parkerhancock/browser-canvas

Then ask Claude to "create a counter app" and watch what happens.

GitHub: [link]
```

### Reddit Post Template (r/ClaudeAI)

**Title**: I built a plugin that lets Claude Code render React UIs by just writing files

**Body**:
```
Been using Claude Code for a few months and kept wishing Claude could see what it builds.

So I made Browser Canvas - a plugin where Claude creates UIs just by writing files to a watched folder. No API calls, no special protocols.

How it works:
- Claude writes App.jsx to .claude/artifacts/myapp/
- Browser window opens automatically
- Claude edits the file → hot reload
- Claude reads events.jsonl to see what users clicked
- Claude can take screenshots to verify rendering

Everything is pre-bundled (shadcn components, Recharts, Tailwind) so Claude doesn't need to deal with imports.

Install: `/plugin install parkerhancock/browser-canvas`

Happy to answer questions. Would love feedback on what components you'd want added.

[Link to GitHub]
```

### Hacker News

**Title**: Show HN: Browser Canvas – Let AI agents render React UIs via file operations

Keep the description brief. HN likes technical depth in comments.

## Phase 3: Content Marketing

### Blog Post Ideas

1. **"Why I built Browser Canvas"** - Problem narrative, file-based protocol decision
2. **"Teaching Claude to see: visual feedback for AI coding agents"** - Technical deep dive
3. **"Building interactive demos with Claude Code"** - Tutorial style

### Demo Projects to Build & Share

| Demo | Purpose |
|------|---------|
| **Live dashboard** | Shows two-way state sync |
| **Form wizard** | Shows event capture |
| **Data visualization** | Shows Recharts integration |
| **Game** | Shows capability range |

Each demo becomes shareable content.

## Phase 4: Community Building

### Respond to Related Problems

Monitor for people asking about:
- "Claude can't see what it built"
- "How to show Claude output visually"
- "Creating UIs with Claude Code"
- "Claude Code GUI"

Respond helpfully, mention Browser Canvas only if relevant.

### Contributor Onboarding

- [ ] Add CONTRIBUTING.md
- [ ] Tag issues as "good first issue"
- [ ] Document how to add new components
- [ ] Create component request template

### Integration Opportunities

Reach out to:
- Other Claude Code plugin authors for cross-promotion
- Claude Code team for potential featuring
- YouTube creators doing AI coding content

## Metrics to Track

| Metric | Target (30 days) |
|--------|------------------|
| GitHub stars | 100+ |
| Plugin installs | 50+ |
| Issues/PRs | 5+ |
| Twitter impressions | 10k+ |

## Anti-Patterns to Avoid

- Don't spam multiple subreddits simultaneously
- Don't post on HN until you have some social proof
- Don't promise features you haven't built
- Don't be defensive about criticism
- Don't post identical content across platforms

## Resources

- [5 tips for promoting your open source project](https://github.blog/open-source/maintainers/5-tips-for-promoting-your-open-source-project/)
- [Marketing for maintainers](https://github.blog/2022-07-28-marketing-for-maintainers-how-to-promote-your-project-to-both-users-and-contributors/)
- [Finding users for your project](https://opensource.guide/finding-users/)
