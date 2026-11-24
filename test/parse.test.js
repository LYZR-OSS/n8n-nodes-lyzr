const test = require('node:test');
const assert = require('node:assert');
const {
	parseAgentReply,
	guardrailResult,
	retrievalResult,
} = require('../dist/nodes/shared/lyzr.js');

test('structured reply is parsed and usage surfaced', () => {
	const r = parseAgentReply(
		{
			response: '{"reply":"hi","needs_human":false}',
			prompt_tokens: 10,
			completion_tokens: 5,
			total_tokens: 15,
			module_outputs: { documents: [{ text: 't', score: 0.9, metadata: { source: 'h.txt' } }] },
		},
		true,
		true,
	);
	assert.deepStrictEqual(r.output, { reply: 'hi', needs_human: false });
	assert.strictEqual(r.blocked, false);
	assert.strictEqual(r.usage.totalTokens, 15);
	assert.deepStrictEqual(r.sources, [{ text: 't', source: 'h.txt', score: 0.9 }]);
});

test('blocked reply is flagged, not parsed', () => {
	const r = parseAgentReply(
		{
			response: '[Content blocked: Prompt injection detected (confidence: 99%)]',
			module_outputs: { documents: [{ text: 'internal escalation rules' }] },
		},
		true,
		true,
	);
	assert.strictEqual(r.output, null);
	assert.strictEqual(r.blocked, true);
	assert.strictEqual(r.blockReason, 'Prompt injection detected (confidence: 99%)');
	assert.strictEqual(r.sources, undefined);
});

test('plain text survives parseOutput', () => {
	assert.strictEqual(parseAgentReply({ response: 'hello' }, true, false).output, 'hello');
});

test('guardrail result drops the raw PII redaction map', () => {
	const r = guardrailResult({
		blocked: false,
		processed_text: 'card <CREDIT_CARD_1>',
		detections: {
			pii: {
				detected: true,
				redacted_types: ['CREDIT_CARD'],
				redaction_map: { 4111: '<CREDIT_CARD_1>' },
			},
		},
	});
	assert.strictEqual(r.text, 'card <CREDIT_CARD_1>');
	assert.deepStrictEqual(r.detections.pii, { detected: true, redacted_types: ['CREDIT_CARD'] });
	assert.ok(!JSON.stringify(r).includes('4111'));
});

test('retrieval results are flattened with a joined context', () => {
	const r = retrievalResult({
		results: [
			{ text: 'REFUNDS ...', score: 0.79, metadata: { source: 'h.txt' } },
			{ text: 'RETURNS ...', score: 0.7, metadata: { source: 'h.txt' } },
		],
	});
	assert.strictEqual(r.resultCount, 2);
	assert.strictEqual(r.context, 'REFUNDS ...\n\nRETURNS ...');
	assert.deepStrictEqual(r.results[0], { text: 'REFUNDS ...', source: 'h.txt', score: 0.79 });
	assert.strictEqual(retrievalResult({}).resultCount, 0);
});
