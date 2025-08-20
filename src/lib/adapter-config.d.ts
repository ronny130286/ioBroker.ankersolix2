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
            BatteryBP1600Count: number;
            BatteryBP2700Count: number;
            HomeLoadID: string;
            ControlSiteID: string;
            EnableControlDP: boolean;
            EnableCustomPowerPlan: boolean;
            PowerPlan: [];
            EnableACLoading: boolean;
            PowerPlanAtReload: boolean;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
