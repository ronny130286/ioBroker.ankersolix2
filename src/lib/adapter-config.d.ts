// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            Username: string;
            Password: string;
            API_Server: string;
            COUNTRY: string;
            COUNTRY2: string;
            POLL_INTERVAL: number;
            AnalysisGrid: boolean;
            AnalysisGridDay: boolean;
            AnalysisGridWeek: boolean;
            AnalysisSolarproduction: boolean;
            AnalysisSolarproductionDay: boolean;
            AnalysisSolarproductionWeek: boolean;
            AnalysisHomeUsage: boolean;
            AnalysisHomeUsageDay: boolean;
            AnalysisHomeUsageWeek: boolean;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
