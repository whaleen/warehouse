# Agent Testing & Documentation Workflow

## Purpose

This document describes how to test the in-app agent chat to discover documentation gaps and improve the system holistically. By systematically testing the agent against actual app features, we can identify where:

- Documentation is missing or incomplete
- Agent responses are inaccurate or hallucinating
- Implemented features aren't properly documented
- Documentation has drifted from implementation

This creates a feedback loop that moves implementation, documentation, and agent comprehension forward together.

## The Testing Philosophy

**Use the app → Ask the agent → Verify the answer → Update the docs**

The agent should be able to accurately explain every feature in the app. When it can't, that's a signal that either:
1. The documentation needs to be written or improved
2. The feature needs clearer implementation
3. The doc search needs tuning

## Testing Workflow

### 1. Explore the App UI

Work through every section of the app systematically:
- Navigate through all pages and features
- Try every button, form, and interaction
- Note what each feature does and how to use it

### 2. Ask the Agent Questions

For each feature you discover, ask the agent:
- "How do I [perform this action]?"
- "What does [this feature] do?"
- "What are the steps to [complete this task]?"

Use the same language a real user would use - don't use technical jargon unless testing developer-facing features.

### 3. Verify Agent Responses

Compare the agent's answer to what you actually see in the app:
- ✅ **Correct**: Steps match the UI, terminology is accurate, citations are valid
- ❌ **Wrong**: Steps don't work, mentions non-existent UI elements, or contradicts reality
- ⚠️ **Incomplete**: Partially correct but missing key steps or context

### 4. Check the Logs

When testing, monitor the service logs to see what documentation the agent is retrieving:

```bash
tail -f /tmp/ge-sync-debug.log | grep "\[Docs\]"
```

Look for:
- Which doc chunks are being returned (should match the topic)
- Score rankings (correct docs should rank highest)
- Whether the right documentation exists at all

### 5. Update Documentation

When you find gaps or errors:

1. **Missing docs**: Create the documentation with step-by-step instructions
2. **Wrong docs**: Correct the steps to match actual implementation
3. **Unclear docs**: Add more detail, screenshots, or examples
4. **Out-of-date docs**: Update to reflect current UI/behavior

Follow the documentation patterns in `docs/warehouse/` - include:
- Clear section titles that match common questions
- Step-by-step instructions with specific UI element names
- "For Operators", "For Developers", and "For Agent" audience notes

### 6. Test Again

After updating docs, test the same question again:
- The service hot-reloads, so doc changes are picked up automatically
- The doc cache is rebuilt on the first query after restart
- Verify the agent now gives the correct answer

## Testing the Agent via API

### Using curl (Command Line)

```bash
# Set your API key (from services/ge-sync/.env)
API_KEY="your-api-key-here"
GROQ_KEY="your-groq-key-here"

# Test a question
curl -s http://localhost:3001/agent/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"provider\": \"groq\",
    \"apiKey\": \"$GROQ_KEY\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"How do I request a sanity check for a load?\"
    }]
  }"
```

### Using JSON Files

Create test files for common queries:

```json
{
  "provider": "groq",
  "apiKey": "your-groq-key",
  "messages": [{
    "role": "user",
    "content": "Your question here"
  }]
}
```

Then test with:
```bash
curl -s http://localhost:3001/agent/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -H "X-API-Key: $API_KEY" \
  -d @test-question.json
```

### Reading the Logs

The logs show the doc search process:

```
[Docs] Searching for: How do I request a sanity check?
[Docs] Total chunks before filtering: 503
[Docs] Is GE DMS query: true
[Docs] After GE DMS filter: 503 -> 260 chunks
[Docs] Warehouse chunks in candidates: 85
[Docs] loads.md chunks (11 total):
  - Request a Sanity Check: score 1320
  - Complete a Sanity Check: score 306
[Docs] Top 8 results:
  1. docs/warehouse/loads.md (Request a Sanity Check) - score: 1320
  2. docs/warehouse/loads.md (Complete a Sanity Check) - score: 306
```

**What to look for:**
- Correct docs should rank in the top 3 results
- Scores for relevant docs should be 10-15x higher than irrelevant docs
- If the right doc doesn't appear at all, it may not exist or needs better keywords

## Pre-Commit Documentation Updates

**As features evolve, documentation must evolve with them.**

When making code changes that affect user-facing features:

### Before Committing

1. **Identify affected docs**: Which documentation files describe this feature?
2. **Update the docs**: Modify the relevant markdown files to reflect changes
3. **Test the agent**: Ask questions about the changed feature and verify correct answers
4. **Include in commit**: Stage both code and doc changes together

### Pre-Commit Hook (Recommended)

Consider adding a pre-commit hook that:
- Checks for UI/feature changes in the diff
- Prompts to review related documentation
- Ensures agent tests pass for critical workflows

```bash
# .git/hooks/pre-commit (example)
#!/bin/bash

# If warehouse UI changed, remind to update docs
if git diff --cached --name-only | grep -q "src/pages/\|src/components/"; then
  echo "⚠️  UI changes detected - have you updated the documentation?"
  echo "   See AGENT-TESTING.md for the testing workflow"
  echo ""
  read -p "Continue with commit? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

## Common Testing Patterns

### Test by Feature Area

Systematically test each section:

- **Loads**: Request sanity check, complete sanity check, update prep status, edit metadata
- **Inventory**: View items, search, filter, scan items
- **Map**: Navigate, view locations, popover content
- **Scanning**: Start session, fog of war mode, ad-hoc mode, quick scan
- **Actions**: View actions, understand prioritization
- **Dashboard**: Understand metrics and recent activity

### Test by User Role

- **Operators**: Focus on day-to-day workflows and common tasks
- **Developers**: Test technical explanations and implementation details
- **Managers**: Test reporting and oversight features

### Test Edge Cases

- Ask about features that don't exist (agent should say "I don't have that information")
- Ask ambiguous questions to test disambiguation
- Ask follow-up questions to test conversation context

## Debugging Doc Search Issues

If the agent gives wrong answers despite docs existing:

### Check the Filter

Is the doc being included in candidates?
```
[Docs] After GE DMS filter: 503 -> 260 chunks
[Docs] Warehouse chunks in candidates: 85
```

If not, check `services/ge-sync/src/agent/docs.ts` filtering logic.

### Check the Score

Is the doc scoring too low?
```
[Docs] loads.md chunks (11 total):
  - Request a Sanity Check: score 1320  ← Should be high
```

If the score is low (<100), the section title may not match query keywords well enough.

### Check the Content

Does the doc actually contain the information?
- Read the markdown file
- Verify step-by-step instructions are present
- Check that terminology matches what users would search for

## Success Metrics

You're succeeding when:

1. ✅ Agent answers match actual app behavior
2. ✅ Every feature in the app has corresponding documentation
3. ✅ New features are documented before/during development
4. ✅ Documentation updates are included in feature PRs
5. ✅ The agent can guide users through complex workflows accurately

## When to Expand This Workflow

Consider adding:
- Automated agent testing suite (run before deploys)
- Documentation coverage reports (% of features documented)
- Agent accuracy metrics (% of correct answers)
- User feedback integration (track when users report wrong answers)

## Related Docs

- `docs/agent/` - Agent-specific documentation
- `docs/warehouse/` - Warehouse app operational docs
- `docs/ge-dms/` - GE DMS system documentation
- `services/ge-sync/docs/` - Technical implementation docs
