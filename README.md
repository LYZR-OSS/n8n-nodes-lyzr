# n8n-nodes-lyzr

[Lyzr](https://www.lyzr.ai) nodes for [n8n](https://n8n.io). Use Lyzr agents, knowledge bases and guardrails in your n8n workflows. Lyzr Studio manages memory, retrieval, safety policies and tracing.

[Installation](#installation) · [Credentials](#credentials) · [Nodes](#nodes) · [Example](#example) · [Compatibility](#compatibility)

## Installation

Follow the n8n [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/). In n8n, go to **Settings → Community Nodes → Install** and enter `n8n-nodes-lyzr`.

## Credentials

Create a **Lyzr API** credential:

| Field                  | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| API Key                | Your API key from [Lyzr Studio](https://studio.lyzr.ai)                                   |
| Agent API URL          | `https://agent-prod.studio.lyzr.ai` (change only for self-hosted or regional deployments) |
| Knowledge Base API URL | `https://rag-prod.studio.lyzr.ai`                                                         |
| Guardrails API URL     | `https://rai-prod.studio.lyzr.ai`                                                         |

The key is sent as the `x-api-key` header. Saving the credential tests it by listing your guardrail policies.

## Nodes

All three nodes can also be attached as tools to n8n's **AI Agent** node.

### Lyzr Agent

Sends a message to a Lyzr agent and returns its reply. Pick the agent from the dropdown, which lists every agent your API key can access. The agent's model, prompt, memory, guardrails and knowledge bases are configured in Lyzr Studio.

| Parameter                         | Description                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Agent                             | The agent to run                                                                                                   |
| Message                           | The user message. Defaults to `{{ $json.chatInput }}`                                                              |
| Session ID                        | Conversation memory is kept per session. Use one ID per end-user conversation. Defaults to `{{ $json.sessionId }}` |
| User ID                           | Identifies the end user in Lyzr traces                                                                             |
| Options → Parse JSON Output       | Parses the reply into an object when the agent has a JSON response format (default on)                             |
| Options → Include Sources         | Returns the knowledge-base passages the agent used                                                                 |
| Options → System Prompt Variables | JSON values for `{{variables}}` in the agent's instructions                                                        |

Output:

```json
{
	"output": "Refunds are processed within 5 business days.",
	"blocked": false,
	"blockReason": null,
	"usage": { "promptTokens": 812, "completionTokens": 64, "totalTokens": 876 },
	"sessionId": "abc-123",
	"agentId": "6650f0..."
}
```

When one of the agent's guardrails blocks the turn, `blocked` is `true`, `output` is `null` and `blockReason` says why.

### Lyzr Knowledge Base

Searches a Lyzr knowledge base and returns the top passages, plus a `context` string you can pass to any LLM.

Output: `{ results: [{ text, source, score }], context, resultCount, knowledgeBaseId }`

### Lyzr Guardrails

Checks text against a Lyzr guardrail policy (PII, prompt injection, toxicity, banned topics and more, depending on the policy).

Output: `{ blocked, blockReason, text, detections, warnings }`. `text` is the processed text, with PII redacted if the policy redacts. The mapping from redacted placeholders to the original values is dropped, so raw PII never reaches n8n's execution log.

To branch on the result, follow the node with an **If** node on `{{ $json.blocked }}`.

## Example

A support chatbot that screens input before the agent sees it:

1. **Chat Trigger**
2. **Lyzr Guardrails**: Text `{{ $json.chatInput }}`, your policy
3. **If** `{{ $json.blocked }}` is true → **Respond to Chat** with a refusal
4. Otherwise → **Lyzr Agent**: Message `{{ $('Lyzr Guardrails').item.json.text }}`, Session ID `{{ $('Chat Trigger').item.json.sessionId }}` → **Respond to Chat** with `{{ $json.output }}`

## Compatibility

Built and tested against `n8n-workflow` 2.48.

## Development

```bash
npm install
npm run dev      # starts n8n locally with these nodes loaded
npm test         # build + unit tests
npm run lint
```

Releases are published by GitHub Actions with npm provenance. Run `npm run release` to bump the version and push the tag.

## License

[MIT](LICENSE)
