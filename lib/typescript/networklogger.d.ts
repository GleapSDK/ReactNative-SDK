declare class GleapNetworkIntercepter {
    requestId: number;
    requests: any;
    maxRequests: number;
    stopped: boolean;
    updatedCallback: any;
    setUpdatedCallback(updatedCallback: any): void;
    getRequests(): unknown[];
    setMaxRequests(maxRequests: number): void;
    setStopped(stopped: boolean): void;
    cleanRequests(): void;
    calcRequestTime(gleapRequestId: string | number): void;
    getTextContentSizeOk(text: string): boolean;
    prepareContent(text: string): string;
    cleanupPayload(payload: any): any;
    preparePayload(payload: any): string;
    start(): void;
    interceptNetworkRequests(callback: any): any;
}
export default GleapNetworkIntercepter;
