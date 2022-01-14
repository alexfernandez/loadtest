declare namespace loadtest {
	export function loadTest(options: LoadTestOptions, err: Function): Operation;
	
    export interface Operation {
        completedRequests: number
    }
	
	export interface LoadTestOptions {
		url: string;
		concurrency?: number;
		maxRequests?: number;
		maxSeconds?: number;
		timeout?: number;
		cookies?: string[];
		headers?: { [headerName: string]: string };
		method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		body?: string | Object;
		contentType?: string;
		requestsPerSecond?: number;
		requestGenerator?(params: any, options: any, client: any, callback: Function): any;
		agentKeepAlive?: boolean;
		quiet?: boolean;
		indexParam?: boolean;
		insecure?: boolean;
		secureProtocol?: string;
		statusCallback?(error: Error, result: any, latency: LoadTestResult): void;
		contentInspector?(result: any): void;
		indexParamCallback?(): string;
	}

	export interface LoadTestResult {
		totalErrors: number,
		totalRequests: number,
		totalTimeSeconds: number,
		percentiles: { [percentile: number]: number }
		rps: number,
		meanLatencyMs: number,
		minLatencyMs: number,
		maxLatencyMs: number,
		errorCodes: { [statusCode: string]: number }
	}
}

export = loadtest;
export as namespace loadtest;
