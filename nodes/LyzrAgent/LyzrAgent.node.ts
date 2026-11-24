import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { lyzrRequest, parseAgentReply, toOptions } from '../shared/lyzr';

export class LyzrAgent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Lyzr Agent',
		name: 'lyzrAgent',
		icon: { light: 'file:../shared/lyzr.svg', dark: 'file:../shared/lyzr.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: 'Send message',
		description: 'Run a Lyzr agent with its managed memory, guardrails and knowledge bases',
		defaults: { name: 'Lyzr Agent' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'lyzrApi', required: true }],
		properties: [
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents' },
				required: true,
				default: '',
				description:
					'The Lyzr agent to run. Its model, prompt, memory, guardrails and knowledge base are configured in Lyzr Studio. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '={{ $json.chatInput }}',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				required: true,
				default: '={{ $json.sessionId }}',
				description:
					'Lyzr keeps conversation memory per session. Use one ID per end-user conversation; a fixed value would share one memory across every user.',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'customer-123',
				description: 'Identifies the end user in Lyzr traces',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Parse JSON Output',
						name: 'parseOutput',
						type: 'boolean',
						default: true,
						description:
							'Whether to parse the reply into an object when the agent has a JSON response format',
					},
					{
						displayName: 'Include Sources',
						name: 'includeSources',
						type: 'boolean',
						default: false,
						description: 'Whether to return the knowledge-base passages the agent retrieved',
					},
					{
						displayName: 'System Prompt Variables',
						name: 'systemPromptVariables',
						type: 'json',
						default: '{}',
						description: 'Values for {{variables}} in the agent instructions',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const agents = (await lyzrRequest.call(
					this,
					'agentUrl',
					'GET',
					'/v3/agents/',
				)) as unknown as IDataObject[];
				return toOptions(agents, (a) => a.name);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const agentId = this.getNodeParameter('agentId', i) as string;
				const sessionId = this.getNodeParameter('sessionId', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const vars = options.systemPromptVariables;
				const res = await lyzrRequest.call(this, 'agentUrl', 'POST', '/v3/inference/chat/', {
					agent_id: agentId,
					session_id: sessionId,
					user_id: this.getNodeParameter('userId', i) as string,
					message: this.getNodeParameter('message', i) as string,
					system_prompt_variables:
						typeof vars === 'string' ? JSON.parse(vars || '{}') : (vars ?? {}),
				});
				out.push({
					json: {
						...parseAgentReply(res, options.parseOutput !== false, options.includeSources === true),
						sessionId,
						agentId,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [out];
	}
}
