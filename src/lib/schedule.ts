import { RecurrenceRule, scheduleJob, type Job } from 'node-schedule';
import { type Ankersolix2 } from '../main';
import { SolarbankModeType, type SolarbankJob } from './apitypes';

export class MySchedule {
    private adapter: Ankersolix2;
    private log: ioBroker.Log;
    public scheduleJobs: Record<string, Job> = {};

    constructor(adapter: Ankersolix2) {
        this.adapter = adapter;
        this.log = adapter.log;
    }

    public async scheduleJobsTimeplan(table: SolarbankJob[]): Promise<void> {
        // Alte Jobs stoppen und löschen
        for (const jobName in this.scheduleJobs) {
            this.scheduleJobs[jobName].cancel();
            delete this.scheduleJobs[jobName];
        }

        // Neue Jobs erstellen
        table.forEach((entry, index) => {
            const jobName = `job_${index}`;
            const [hour, minute] = entry.start_time.split(':').map(Number);

            const rule = new RecurrenceRule();
            rule.hour = hour;
            rule.minute = minute;

            const job = scheduleJob(rule, () => {
                this.log.info(`Job ${jobName} gestartet mit Modus: ${entry.mode_type}`);
                this.setSBUsageMode(entry.mode_type);
            });

            this.scheduleJobs[jobName] = job;
        });
    }

    public stopAllJobs(): void {
        Object.entries(this.scheduleJobs).forEach(([jobName, job]) => {
            this.log.debug(`Job : ${jobName} deleted.`);
            job.cancel();
        });

        for (const key in this.scheduleJobs) {
            delete this.scheduleJobs[key];
        }
    }

    public showAllJobs(): void {
        Object.entries(this.scheduleJobs).forEach(([jobName, job]) => {
            this.log.info(
                `Job : ${jobName} next Invocation: ${job?.nextInvocation() ? String(job?.nextInvocation()) : 'undefined'}`,
            );
        });
    }

    public setSBUsageMode(mode: SolarbankModeType): void {
        this.adapter.setHomeLoadID(false);
        switch (mode) {
            case SolarbankModeType.manual:
                this.log.info(`Solarbank ist im benutzerdefinierten Modus`);
                this.adapter.setPowerPlan({ modus: SolarbankModeType.manual });
                break;
            case SolarbankModeType.smartmeter:
                this.log.info(`Solarbank ist im Eigenbedarf Modus`);
                this.adapter.setPowerPlan({ modus: SolarbankModeType.smartmeter });
                break;
            case SolarbankModeType.backup:
                this.log.info(`Solarbank ist AC Loading`);
                this.adapter.setACLoading(true);
                break;
            case SolarbankModeType.controlbyadapter:
                this.log.info(`Solarbank wird durch den Adapter gesteuert`);
                this.adapter.setHomeLoadID(true, true);
                break;
            default:
                this.log.info(`Unbekannter Modus: ${mode}`);
        }
    }
}
