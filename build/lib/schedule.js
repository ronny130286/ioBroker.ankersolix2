"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySchedule = void 0;
const node_schedule_1 = require("node-schedule");
const apitypes_1 = require("./apitypes");
class MySchedule {
    adapter;
    log;
    scheduleJobs = {};
    constructor(adapter) {
        this.adapter = adapter;
        this.log = adapter.log;
    }
    async scheduleJobsTimeplan(table) {
        // Alte Jobs stoppen und löschen
        for (const jobName in this.scheduleJobs) {
            this.scheduleJobs[jobName].cancel();
            delete this.scheduleJobs[jobName];
        }
        // Neue Jobs erstellen
        table.forEach((entry, index) => {
            const jobName = `job_${index}`;
            const [hour, minute] = entry.start_time.split(':').map(Number);
            const rule = new node_schedule_1.RecurrenceRule();
            rule.hour = hour;
            rule.minute = minute;
            const job = (0, node_schedule_1.scheduleJob)(rule, () => {
                this.log.info(`Job ${jobName} gestartet mit Modus: ${entry.mode_type}`);
                this.setSBUsageMode(entry.mode_type);
            });
            this.scheduleJobs[jobName] = job;
        });
    }
    stopAllJobs() {
        Object.entries(this.scheduleJobs).forEach(([jobName, job]) => {
            this.log.debug(`Job : ${jobName} deleted.`);
            job.cancel();
        });
        for (const key in this.scheduleJobs) {
            delete this.scheduleJobs[key];
        }
    }
    showAllJobs() {
        Object.entries(this.scheduleJobs).forEach(([jobName, job]) => {
            this.log.info(`Job : ${jobName} next Invocation: ${job?.nextInvocation() ? String(job?.nextInvocation()) : 'undefined'}`);
        });
    }
    setSBUsageMode(mode) {
        this.adapter.setHomeLoadID(false);
        switch (mode) {
            case apitypes_1.SolarbankModeType.manual:
                //this.log.info(`Solarbank ist im benutzerdefinierten Modus`);
                this.adapter.setPowerPlan({ modus: apitypes_1.SolarbankModeType.manual });
                break;
            case apitypes_1.SolarbankModeType.smartmeter:
                //this.log.info(`Solarbank ist im Eigenbedarf Modus`);
                this.adapter.setPowerPlan({ modus: apitypes_1.SolarbankModeType.smartmeter });
                break;
            case apitypes_1.SolarbankModeType.backup:
                //this.log.info(`Solarbank ist AC Loading`);
                this.adapter.setACLoading(true);
                break;
            case apitypes_1.SolarbankModeType.controlbyadapter:
                //this.log.info(`Solarbank wird durch den Adapter gesteuert`);
                this.adapter.setHomeLoadID(true, true);
                break;
            default:
                this.log.info(`Unbekannter Modus: ${mode}`);
        }
    }
}
exports.MySchedule = MySchedule;
//# sourceMappingURL=schedule.js.map