import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LyzrApi implements ICredentialType {
	name = 'lyzrApi';
	displayName = 'Lyzr API';
	documentationUrl = 'https://docs.lyzr.ai';
	icon = 'file:../nodes/shared/lyzr.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Agent API URL',
			name: 'agentUrl',
			type: 'string',
			default: 'https://agent-prod.studio.lyzr.ai',
		},
		{
			displayName: 'Knowledge Base API URL',
			name: 'ragUrl',
			type: 'string',
			default: 'https://rag-prod.studio.lyzr.ai',
		},
		{
			displayName: 'Guardrails API URL',
			name: 'raiUrl',
			type: 'string',
			default: 'https://rai-prod.studio.lyzr.ai',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { 'x-api-key': '={{$credentials.apiKey}}' } },
	};

	test: ICredentialTestRequest = {
		request: { baseURL: '={{$credentials.raiUrl}}', url: '/v1/rai/policies' },
	};
}
