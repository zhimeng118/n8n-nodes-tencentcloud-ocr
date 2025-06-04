import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import * as tencentcloud from 'tencentcloud-sdk-nodejs-ocr';
import { GeneralAccurateOCRRequest } from 'tencentcloud-sdk-nodejs-ocr/tencentcloud/services/ocr/v20181119/ocr_models';

const OcrClient: typeof tencentcloud.ocr.v20181119.Client = tencentcloud.ocr.v20181119.Client;

export class TencentCloudOcr implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TencentCloudOcr',
		name: 'tencentCloudOcr',
		group: ['transform'],
		version: 1,
		description: 'Make HttpRequest to Ocr API, Only support tencent cloud ocr api !',
		defaults: {
			name: 'Request TencentCloud ORC API',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [],
		properties: [
			{
				displayName: 'SecretId',
				name: 'secretId',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				placeholder: 'Input SecretId',
			},
			{
				displayName: 'SecretKey',
				name: 'secretKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				placeholder: 'Input SecretKey',
			},
			{
				displayName: 'ImageBase64 Field',
				name: 'imageBase64Field',
				type: 'string',
				default: 'data',
				placeholder: 'ImageBase64 Field',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// 1. 构造请求client
		const secretId = this.getNodeParameter('secretId', 0, '') as string;
		const secretKey = this.getNodeParameter('secretKey', 0, '') as string;
		const imageBase64Field = this.getNodeParameter('imageBase64Field', 0, 'data') as string;
		const clientConfig = {
			credential: {
				secretId,
				secretKey,
			},
			region: '',
			profile: {
				httpProfile: {
					endpoint: 'ocr.tencentcloudapi.com',
				},
			},
		};
		const client = new OcrClient(clientConfig);

		let responseData: IDataObject = {};
		let returnData = [];

		// 2. 处理OCR请求
		const items = this.getInputData();
		let item: INodeExecutionData;
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				const params: GeneralAccurateOCRRequest = {
					ImageBase64: item.json[imageBase64Field] as string,
				};
				await client.RecognizeGeneralInvoice(params).then(
					(data) => {
						responseData = JSON.parse(JSON.stringify(data));
					},
					(err) => {
						console.log(err);
						returnData.push({
							json: { error: err.message },
							pairedItem: itemIndex,
						});
					},
				);
			} catch (error) {
				if (this.continueOnFail()) {
					let errorJson = {
						error: error.message,
					};
					if (error.name === 'NodeApiError') {
						errorJson.error = error?.cause?.error;
					}
					returnData.push({
						json: errorJson,
						pairedItem: itemIndex,
					});
					continue;
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData as IDataObject),
				{ itemData: { item: itemIndex } },
			);
			returnData.push(...executionData);
		}

		return [returnData];
	}
}
