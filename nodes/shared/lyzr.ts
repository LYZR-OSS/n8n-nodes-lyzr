import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

export async function lyzrRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	service: 'agentUrl' | 'raiUrl' | 'ragUrl',
	method: IHttpRequestMethods,
	url: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('lyzrApi');
	return this.helpers.httpRequestWithAuthentication.call(this, 'lyzrApi', {
		method,
		baseURL: String(credentials[service]).replace(/\/+$/, ''),
		url,
		body,
		qs,
		json: true,
		// An agent turn with tools and retrieval can run for minutes.
		timeout: 300_000,
	});
}

export function toOptions(
	items: IDataObject[],
	label: (i: IDataObject) => unknown,
): INodePropertyOptions[] {
	return items
		.map((i) => ({
			name: String(label(i)),
			value: String(i._id ?? i.id),
			description: String(i.description ?? ''),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

// lyzr-agent replaces the reply with this marker when a guardrail blocks the turn (BLOCK_MARKER in lyzr_llm.py).
const BLOCK_MARKER = '[Content blocked';

export function parseAgentReply(
	res: IDataObject,
	parseOutput: boolean,
	includeSources: boolean,
): IDataObject {
	const raw = typeof res.response === 'string' ? res.response : JSON.stringify(res.response ?? '');
	const blocked = raw.startsWith(BLOCK_MARKER);
	let output: unknown = blocked ? null : raw;
	if (!blocked && parseOutput) {
		try {
			output = JSON.parse(raw);
		} catch {
			// Agents without a JSON response format reply in plain text; keep it as-is.
		}
	}
	const out: IDataObject = {
		output: output as IDataObject,
		blocked,
		blockReason: blocked
			? raw.slice(BLOCK_MARKER.length).replace(/^:\s*/, '').replace(/\]$/, '')
			: null,
		usage: {
			promptTokens: res.prompt_tokens ?? null,
			completionTokens: res.completion_tokens ?? null,
			totalTokens: res.total_tokens ?? null,
		},
	};
	if (includeSources && !blocked) {
		out.sources = toSources((res.module_outputs as IDataObject | undefined)?.documents);
	}
	return out;
}

function toSources(docs: unknown): IDataObject[] {
	return ((docs ?? []) as IDataObject[]).map((d) => ({
		text: d.text,
		source: (d.metadata as IDataObject | undefined)?.source ?? null,
		score: d.score,
	}));
}

export function retrievalResult(res: IDataObject): IDataObject {
	const results = toSources(res.results);
	return { results, context: results.map((r) => r.text).join('\n\n'), resultCount: results.length };
}

export function guardrailResult(res: IDataObject): IDataObject {
	const { pii, ...rest } = (res.detections ?? {}) as IDataObject;
	const detections: IDataObject = { ...rest };
	if (pii) {
		// redaction_map maps placeholders back to the raw values; keeping it would write the PII we just
		// redacted into n8n's execution log.
		const safe = { ...(pii as IDataObject) };
		delete safe.redaction_map;
		detections.pii = safe;
	}
	return {
		blocked: Boolean(res.blocked),
		blockReason: res.block_reason ?? null,
		text: res.processed_text ?? '',
		detections,
		warnings: res.warnings ?? [],
	};
}
