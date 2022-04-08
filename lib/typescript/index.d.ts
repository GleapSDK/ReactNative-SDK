export declare type GleapUserProperty = {
    email?: string;
    name?: string;
};
declare type GleapActivationMethod = 'SHAKE' | 'SCREENSHOT';
declare type GleapSdkType = {
    initialize(token: string): void;
    open(): void;
    startFeedbackFlow(feedbackFlow: string): void;
    sendSilentBugReport(description: string, severity: 'LOW' | 'MEDIUM' | 'HIGH'): void;
    sendSilentBugReportWithType(description: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', type: string): void;
    identify(userId: string, userProperties: GleapUserProperty): void;
    clearIdentity(): void;
    setApiUrl(apiUrl: string): void;
    setWidgetUrl(widgetUrl: string): void;
    attachCustomData(customData: any): void;
    setCustomData(key: string, value: string): void;
    removeCustomDataForKey(key: string): void;
    clearCustomData(): void;
    registerCustomAction(customActionCallback: (data: {
        name: string;
    }) => void): void;
    registerListener(eventType: string, callback: (data?: any) => void): void;
    setLanguage(language: string): void;
    logEvent(name: string, data: any): void;
    addAttachment(base64file: string, fileName: string): void;
    removeAllAttachments(): void;
    startNetworkLogging(): void;
    stopNetworkLogging(): void;
    enableDebugConsoleLog(): void;
    setActivationMethods(activationMethods: GleapActivationMethod[]): void;
};
declare const _default: GleapSdkType;
export default _default;
