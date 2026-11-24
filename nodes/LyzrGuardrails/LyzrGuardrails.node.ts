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
import { guardrailResult, lyzrRequest, toOptions } from '../shared/lyzr';

export class LyzrGuardrails implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Lyzr Guardrails',
		name: 'lyzrGuardrails',
		icon: { light: 'file:../shared/lyzr.svg', dark: 'file:../shared/lyzr.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: 'Check text',
		description: 'Check text against a Lyzr guardrail policy',
		defaults: { name: 'Lyzr Guardrails' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'lyzrApi', required: true }],
		properties: [
			{
				displayName: 'Policy Name or ID',
				name: 'policyId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPolicies' },
				required: true,
				default: '',
				description:
					'The guardrail policy to apply. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '={{ $json.chatInput }}',
			},
		],
	};

	methods = {
		loadOptions: {
			async getPolicies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = await lyzrRequest.call(this, 'raiUrl', 'GET', '/v1/rai/policies');
				return toOptions((res.policies ?? []) as IDataObject[], (p) => p.name);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const res = await lyzrRequest.call(this, 'raiUrl', 'POST', '/v1/rai/inference', {
					policy_id: this.getNodeParameter('policyId', i) as string,
					input_text: this.getNodeParameter('text', i) as string,
				});
				out.push({ json: guardrailResult(res), pairedItem: { item: i } });
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
