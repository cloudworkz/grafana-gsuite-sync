#!/usr/bin/env node

import * as commander from "commander";
import * as express from "express";
import { readFile } from "fs";
import { auth } from "google-auth-library";
import { admin_directory_v1, google } from "googleapis";
import * as pino from "pino";
import { collectDefaultMetrics, Counter, register } from "prom-client";
import * as request from "request-promise";
import { promisify } from "util";

const readFileAsync = promisify(readFile);

const collect = (value: string | string[], previous: string[]) => {
    const splitValue = Array.isArray(value) ? value : value.split(",");
    return previous.concat(splitValue);
};

commander
    .option("-p, --port [port]", "Server port")
    .option("-P, --grafana-protocol [grafana-protocol]", "Grafana API protocol", /^(http|https)$/i)
    .option("-H, --grafana-host [grafana-host]", "Grafana API host")
    .option("-U, --grafana-username [grafana-username]", "Grafana API admin username", "")
    .option("-P, --grafana-password <grafana-password>", "Grafana API admin password", "")
    .option("-C, --google-credentials <google-credentials>", "Path to google admin directory credentials file", "")
    .option("-A, --google-admin-email <google-admin-email>", "The Google Admin Email for subject", "")
    .option(
        "-r, --rules <rules>",
        "Comma separated or repeatable rules to sync <google group email>:<grafana org name>:<users role> \n\t" +
        "(e.g. 'group@test.com:Main:Admin')",
        collect,
        [],
    )
    .option(
        "-s, --static-rules <static-rules>",
        "Comma separated or repeatable static rules to create <email>:<grafana org name>:<user role> \n\t" +
        "(e.g. 'user@test.com:Main:Viewer')",
        collect,
        [],
    )
    .option("-l, --level [level]", "Log level", /^(debug|info|warn|error|fatal)$/i)
    .option("-m, --mode [mode]",
        "How users are sychronized between google and grafana: sync or upsert-only", /^(sync|upsert-only)$/i)
    .option("-e, --exclude-role [exclude-role]", "Exclude role to delete", /^(Admin|Editor|Viewer)$/i)
    .option("-i, --interval [interval]", "Sync interval")
    .parse(process.argv);

const app = express();
const port = process.env.PORT || commander.port || 5000;

class GrafanaSync {
    public service: admin_directory_v1.Admin;
    public client: any;
    public updateRunning: boolean;
    public logLevel: string;
    public logger: pino.Logger;
    public grafanaProtocol: string;
    public grafanaHost: string;
    public grafanaUsername: string;
    public grafanaPassword: string;
    public grafanaUri: string;
    public credentialsPath: string;
    public googleAdminEmail: string;
    public rules: string[];
    public staticRules: string[];
    public mode: string;
    public excludeRole: string;
    public interval: number;
    public metricsInterval: NodeJS.Timeout;
    public success: Counter;
    public fail: Counter;
    public grafanaMembers: Map<string, string[]>;
    public googleMembers: Map<string, string[]>;

    constructor() {
        this.updateRunning = false;
        this.logLevel = process.env.LEVEL || commander.level || "info";
        this.logger = pino({
            prettyPrint: process.env.NODE_ENV !== "production",
            level: this.logLevel,
        });

        this.grafanaProtocol = process.env.GRAFANA_PROTOCOL || commander.grafanaProtocol || "http";
        this.grafanaHost = process.env.GRAFANA_HOST || commander.grafanaHost || "localhost:3000";
        this.grafanaUsername = process.env.GRAFANA_USERNAME || commander.grafanaUsername || "admin";
        this.grafanaPassword = process.env.GRAFANA_PASSWORD || commander.grafanaPassword || "";
        this.grafanaUri = `${this.grafanaProtocol}://${this.grafanaUsername}:${this.grafanaPassword}@${this.grafanaHost}`;

        this.credentialsPath = process.env.GOOGLE_CREDENTIALS || commander.googleCredentials || ".credentials.json";
        this.googleAdminEmail = process.env.GOOGLE_ADMIN_EMAIL || commander.googleAdminEmail || "";
        this.rules = process.env.RULES || commander.rules || [];
        this.staticRules = process.env.STATIC_RULES || commander.staticRules || [];
        this.mode = process.env.MODE || commander.mode || "sync";
        this.excludeRole = process.env.EXCLUDE_ROLE || commander.excludeRole || "";

        this.metricsInterval = collectDefaultMetrics();
        this.success = new Counter({
            help: "Successful grafana gsuite sync counter",
            name: "grafana_gsuite_sync_success",
        });
        this.fail = new Counter({
            help: "Unsuccessful grafana gsuite sync counter",
            name: "grafana_gsuite_sync_fail",
        });
        this.grafanaMembers = new Map(); // { orgId: ["email1","email2"]}
        this.googleMembers = new Map(); // { orgId: ["email1","email2"]}
    }

    public async getGoogleApiClient() {
        if (this.service && this.client) {
            return;
        }
        try {
            this.logger.debug("Get google api client");
            const content = await readFileAsync(this.credentialsPath);
            const credentials = JSON.parse(content.toString());
            const client: any = auth.fromJSON(credentials, {});
            client.subject = this.googleAdminEmail;
            client.scopes = [
                "https://www.googleapis.com/auth/admin.directory.group.member.readonly",
                "https://www.googleapis.com/auth/admin.directory.group.readonly",
            ];
            await client.authorize();
            this.client = client;
            this.service = google.admin("directory_v1");
        } catch (e) {
            this.logger.error(e);
        }
    }

    public async getGroupMembers(email: string) {
        await this.getGoogleApiClient();
        if (!this.service || !this.client) {
            this.logger.debug("The google api is not configured.");
            return [];
        }
        const response = await this.service.members.list({
            auth: this.client,
            groupKey: email,
        });

        if (response.status !== 200 || !response.data || !response.data.members) {
            throw new Error("Failed to get members list.");
        }
        let members = [];
        await Promise.all(response.data.members.filter((m) => m.email).map(async (member) => {
            if (member.type === "GROUP") {
                const subMembers = await this.getGroupMembers(member.email);
                members = members.concat(subMembers);
            } else {
                members.push(member.email);
            }
        }));
        return members;
    }

    public async getGrafanaOrgId(name: string) {
        try {
            this.logger.debug({ name }, "Get grafana organisation by name.");
            const response = await request({
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json: true,
                uri: `${this.grafanaUri}/api/orgs/name/${name}`,
            });
            this.logger.debug({ name, response }, "Got grafana organisation by name.");
            if (!response.id) {
                throw new Error(`Could not get grafana orgatiosation by name ${name}`);
            }
            return response.id;
        } catch (e) {
            this.logger.error({ name }, e);
        }
    }

    public async getGrafanaOrgUsers(orgId: string, role: string) {
        try {
            this.logger.debug({ orgId }, "Get grafana organisation users.");
            const response = await request({
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json: true,
                uri: `${this.grafanaUri}/api/orgs/${orgId}/users`,
            });
            this.logger.debug({ orgId, response }, "Got grafana organisation users.");
            if (response.constructor !== Array) {
                return [];
            }
            return response
                .filter((m) => m.email && m.email !== "admin@localhost")
                .filter((m) => m.role && m.role === role)
                .map((m) => m.email);
        } catch (e) {
            this.logger.error({ orgId }, e);
        }
    }

    public async getGrafanaUserId(email: string) {
        try {
            this.logger.debug({ email }, "Get grafana user id.");
            const response = await request({
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json: true,
                uri: `${this.grafanaUri}/api/users/lookup?loginOrEmail=${email}`,
            });
            this.logger.debug({ email, response }, "Got grafana user id.");
            if (response.constructor !== Object) {
                throw new Error(`Could not get user by email: ${email}`);
            }
            return response.id;
        } catch (e) {
            this.logger.error({ email }, e);
        }
    }

    public async getGrafanaUserRole(userId: string, orgId: string, email: string) {
        try {
            const response = await request({
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json: true,
                uri: `${this.grafanaUri}/api/users/${userId}/orgs`,
            });
            this.logger.debug({ userId, email, response }, "Got grafana user.");
            if (response.constructor !== Array) {
                throw new Error(`Could not get user: ${userId}`);
            }
            const userOrgs = response.filter((u) => u.orgId.toString() === orgId.toString());
            if (!userOrgs || userOrgs.length !== 1) {
                return "";
            }
            const role = userOrgs[0].role;
            this.logger.debug({ userId, email, role }, "Got grafana user role.");
            return role;
        } catch (e) {
            this.logger.error({ userId }, e);
        }
    }

    public async createGrafanaUser(orgId: string, email: string, role: string) {
        // Only works if the user already signed up e.g. Google Auth
        try {
            this.logger.debug({ orgId, email, role }, "Create grafana user.");
            const response = await request({
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: {
                    loginOrEmail: email,
                    role,
                },
                json: true,
                uri: `${this.grafanaUri}/api/orgs/${orgId}/users`,
            });
            this.logger.debug({ orgId, email, role, response }, "Created grafana organisation user.");
            return response;
        } catch (e) {
            this.logger.debug({ orgId, email, role }, e);
        }
    }

    public async updateGrafanaUser(orgId: string, userId: string, role: string) {
        try {
            this.logger.debug({ orgId, userId, role }, "Update grafana user.");
            const response = await request({
                method: "PATCH",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: {
                    role,
                },
                json: true,
                uri: `${this.grafanaUri}/api/orgs/${orgId}/users/${userId}`,
            });
            this.logger.debug({ orgId, userId, role, response }, "Updated grafana user.");
            return response;
        } catch (e) {
            this.logger.error({ orgId, userId, role }, e);
        }
    }

    public async deleteGrafanaUser(orgId: string, userId: string, email: string) {
        try {
            this.logger.debug({
                orgId,
                userId,
                email,
            }, "Delete grafana user.");
            const response = await request({
                method: "DELETE",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json: true,
                uri: `${this.grafanaUri}/api/orgs/${orgId}/users/${userId}`,
            });
            this.logger.debug({ orgId, userId, response }, "Delete grafana user.");
            return response;
        } catch (e) {
            this.logger.error({ orgId, userId }, e);
        }
    }

    public async sync() {
        try {
            if (this.updateRunning) {
                this.logger.debug("Update is already running. Skipping...");
                return;
            }
            this.logger.info("Start sync process");
            this.updateRunning = true;

            // Build grafana and google users cache
            await Promise.all(this.rules.map(async (rule) => {
                try {
                    const groupEmail = rule.split(":")[0];
                    const orgName = rule.split(":")[1];
                    const role = rule.split(":")[2];
                    if (!groupEmail || !orgName || !role) {
                        throw new Error("Email or organization name or role missing.");
                    }

                    const orgId = await this.getGrafanaOrgId(orgName);
                    if (!orgId) {
                        throw new Error("Could not get grafana organisation");
                    }
                    const uniqueId = `${orgId}:${role}`;
                    this.grafanaMembers.set(uniqueId, (this.grafanaMembers.get(uniqueId) || []).concat(await this.getGrafanaOrgUsers(orgId, role)));

                    await this.getGoogleApiClient();
                    this.googleMembers.set(uniqueId, (this.googleMembers.get(uniqueId) || []).concat(await this.getGroupMembers(groupEmail)));

                    this.success.inc();

                } catch (e) {
                    this.fail.inc();
                    this.logger.error(e);
                }
            }));

            this.logger.debug(this.googleMembers, "Google members map before create/update");
            this.logger.debug(this.grafanaMembers, "Grafana members map before create/update");

            // create or update all google users in grafana
            await Promise.all(Array.from(this.googleMembers.keys()).map(async (uniqueId) => {
                const emails = this.googleMembers.get(uniqueId);
                const orgId = uniqueId.split(":")[0];
                const role = uniqueId.split(":")[1];
                await Promise.all(emails.map(async (email) => {
                    try {
                        this.logger.info({ email, orgId, role }, "Sync gsuite rule");
                        const userId = await this.getGrafanaUserId(email);
                        if (userId) {
                            if (!this.grafanaMembers.get(uniqueId).find((e) => e === email)) {
                                await this.createGrafanaUser(orgId, email, role);
                            } else {
                                await this.updateGrafanaUser(orgId, userId, role);
                            }
                        }
                    } catch (e) {
                        this.logger.error(e);
                    } finally {
                        this.logger.debug(`Remove user ${email} from sync map.`);
                        this.grafanaMembers.set(uniqueId, this.grafanaMembers.get(uniqueId).filter((e) => e !== email));
                    }
                }));
            }));

            this.logger.debug(this.googleMembers, "Google members map before delete");
            this.logger.debug(this.grafanaMembers, "Grafana members map before delete");

            // delete users which are not in google groups
            if (this.mode === "sync") {
                await Promise.all(Array.from(this.grafanaMembers.keys()).map(async (uniqueId) => {
                    const emails = this.grafanaMembers.get(uniqueId);
                    const orgId = uniqueId.split(":")[0];
                    await Promise.all(emails.map(async (email) => {
                        const userId = await this.getGrafanaUserId(email);
                        if (userId) {
                            const userRole = await this.getGrafanaUserRole(userId, orgId, email);
                            if (this.excludeRole !== userRole && !this.googleMembers.get(uniqueId).find((e) => e === email)) {
                                await this.deleteGrafanaUser(orgId, userId, email);
                            }
                        }
                    }));
                }));
            }

            // create or update static users
            await Promise.all(this.staticRules.map(async (rule) => {
                const email = rule.split(":")[0];
                const orgName = rule.split(":")[1];
                const role = rule.split(":")[2];
                if (!email || !orgName || !role) {
                    throw new Error("Email or organization name or role missing.");
                }
                const orgId = await this.getGrafanaOrgId(orgName);
                if (!orgId) {
                    throw new Error("Could not get grafana organisation");
                }
                this.logger.info({ email, orgId, role }, "Sync static rule");
                const uniqueId = `${orgId}:${role}`;
                try {
                    const userId = await this.getGrafanaUserId(email);
                    if (userId) {
                        try {
                            await this.createGrafanaUser(orgId, email, role);
                        } catch (e) {
                            await this.updateGrafanaUser(orgId, userId, role);
                        }
                    }
                } catch (e) {
                    this.logger.error(e);
                } finally {
                    if (this.grafanaMembers.get(uniqueId)) {
                        this.logger.debug(`Remove user ${email} from sync map.`);
                        this.grafanaMembers.set(uniqueId, this.grafanaMembers.get(uniqueId).filter((e) => e !== email));
                    }
                }
            }));

            this.googleMembers.clear();
            this.grafanaMembers.clear();
            this.logger.info("End sync process");
            this.updateRunning = false;
        } catch (e) {
            this.fail.inc();
            this.logger.error(e);
            this.updateRunning = false;
        }
    }
}

const grafanaSync = new GrafanaSync();

app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "UP" });
});

app.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", register.contentType);
        res.end(register.metrics());
    } catch (e) {
        res.status(503).json({ error: e.toString() });
    }
});

const server = app.listen(port, () => {
    console.info(`Server listening on port ${port}!`);
    grafanaSync.sync();
});

const interval = process.env.INTERVAL || commander.interval || 24 * 60 * 60 * 1000;
const updateInterval = setInterval(grafanaSync.sync, parseInt(interval, 10));

process.on("SIGTERM", () => {
    clearInterval(updateInterval);

    server.close((err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        process.exit(0);
    });
});
