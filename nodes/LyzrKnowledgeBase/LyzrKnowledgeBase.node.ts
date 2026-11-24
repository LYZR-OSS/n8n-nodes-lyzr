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
import { lyzrRequest, retrievalResult, toOptions } from '../shared/lyzr';

export class LyzrKnowledgeBase implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Lyzr Knowledge Base',
		name: 'lyzrKnowledgeBase',
		icon: { light: 'file:../shared/lyzr.svg', dark: 'file:../shared/lyzr.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: 'Search',
		description: 'Search a Lyzr knowledge base',
		defaults: { name: 'Lyzr Knowledge Base' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'lyzrApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Search', value: 'search', action: 'Search a knowledge base' }],
				default: 'search',
			},
			{
				displayName: 'Knowledge Base Name or ID',
				name: 'knowledgeBaseId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getKnowledgeBases' },
				required: true,
				default: '',
				description:
					'The Lyzr knowledge base to search. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '={{ $json.chatInput }}',
			},
			{
				displayName: 'Number of Results',
				name: 'topK',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 50 },
				default: 5,
			},
		],
	};

	methods = {
		loadOptions: {
			async getKnowledgeBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = await lyzrRequest.call(this, 'ragUrl', 'GET', '/v3/rag/user/');
				return toOptions(
					(res.configs ?? []) as IDataObject[],
					(k) => k.name || k.description || k.collection_name,
				);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const id = this.getNodeParameter('knowledgeBaseId', i) as string;
				const res = await lyzrRequest.call(
					this,
					'ragUrl',
					'GET',
					`/v3/rag/${encodeURIComponent(id)}/retrieve/`,
					undefined,
					{
						query: this.getNodeParameter('query', i) as string,
						top_k: this.getNodeParameter('topK', i) as number,
						retrieval_type: 'basic',
						score_threshold: 0,
					},
				);
				out.push({
					json: { ...retrievalResult(res), knowledgeBaseId: id },
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
