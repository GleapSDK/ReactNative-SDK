declare class GleapNetworkIntercepter {
    requestId: number;
    requests: any;
    maxRequests: number;
    stopped: boolean;
    getRequests(): unknown[];
    setMaxRequests(maxRequests: number): void;
    setStopped(stopped: boolean): void;
    cleanRequests(): void;
    calcRequestTime(gleapRequestId: string | number): void;
    contentSizeOk(text: string): boolean;
    start(): void;
    interceptNetworkRequests(callback: any): any;
}
export default GleapNetworkIntercepter;
