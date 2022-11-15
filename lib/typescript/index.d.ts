export declare type GleapUserProperty = {
    email?: string;
    name?: string;
    phone?: string;
    value?: number;
};
declare type GleapActivationMethod = 'SHAKE' | 'SCREENSHOT';
declare type GleapSdkType = {
    initialize(token: string): void;
    startFeedbackFlow(feedbackFlow: string, showBackButton: boolean): void;
    sendSilentCrashReport(description: string, severity: 'LOW' | 'MEDIUM' | 'HIGH'): void;
    sendSilentCrashReportWithExcludeData(description: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', excludeData: {
        customData?: Boolean;
        metaData?: Boolean;
        attachments?: Boolean;
        consoleLog?: Boolean;
        networkLogs?: Boolean;
        customEventLog?: Boolean;
        screenshot?: Boolean;
        replays?: Boolean;
    }): void;
    open(): void;
    close(): void;
    isOpened(): boolean;
    identify(userId: string, userProperties: GleapUserProperty): void;
    identifyWithUserHash(userId: string, userProperties: GleapUserProperty, userHash: string): void;
    clearIdentity(): void;
    preFillForm(formData: {
        [key: string]: string;
    }): void;
    setApiUrl(apiUrl: string): void;
    setFrameUrl(frameUrl: string): void;
    attachCustomData(customData: any): void;
    setCustomData(key: string, value: string): void;
    removeCustomDataForKey(key: string): void;
    clearCustomData(): void;
    registerListener(eventType: string, callback: (data?: any) => void): void;
    setLanguage(language: string): void;
    enableDebugConsoleLog(): void;
    disableConsoleLog(): void;
    log(message: string): void;
    logWithLogLevel(message: string, logLevel: 'INFO' | 'WARNING' | 'ERROR'): void;
    trackEvent(name: string, data: any): void;
    addAttachment(base64file: string, fileName: string): void;
    removeAllAttachments(): void;
    startNetworkLogging(): void;
    stopNetworkLogging(): void;
    setActivationMethods(activationMethods: GleapActivationMethod[]): void;
    registerCustomAction(customActionCallback: (data: {
        name: string;
    }) => void): void;
};
declare const _default: GleapSdkType;
export default _default;
