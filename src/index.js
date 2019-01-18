#!/usr/bin/env node
"use strict";

const commander = require("commander");
const express = require("express");
const { readFile } = require("fs");
const { auth } = require("google-auth-library");
const { google } = require("googleapis");
const pino = require("pino");
const { collectDefaultMetrics, Counter, register } = require("prom-client");
const request = require("request-promise");
const { promisify } = require("util");

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
        "Comma separated rules to sync <google group email>:<grafana org name>:<users role> \n\t" +
        "(e.g. 'group@test.com:Main:Admin')",
        (val) => val.split(",")
    )
    .option(
        "-s, --static-rules <static-rules>",
        "Comma separated static rules to create <email>:<grafana org name>:<user role> \n\t" +
        "(e.g. 'user@test.com:Main:Viewer')",
        (val) => val.split(",")
    )
    .option("-l, --level [level]", "Log level", /^(debug|info|warn|error|fatal)$/i)
    .option("-m, --mode [mode]", "How users are sychronized between google and grafana: sync or upsert-only", /^(sync|upsert-only)$/i)
    .option("-e, --exclude-role [exclude-role]", "Exclude role to delete", /^(Admin|Editor|Viewer)$/i)
    .option("-i, --interval [interval]", "Sync interval")
    .parse(process.argv);

const readFileAsync = promisify(readFile);
const logLevel = process.env.LEVEL || commander.level || "info";
const logger = pino({
    prettyPrint: process.env.NODE_ENV !== "production",
    level: logLevel,
});
const app = express();
const port = process.env.PORT || commander.port || 5000;

const grafanaProtocol = process.env.GRAFANA_PROTOCOL || commander.grafanaProtocol || "http";
const grafanaHost = process.env.GRAFANA_HOST || commander.grafanaHost || "localhost:3000";
const grafanaUsername = process.env.GRAFANA_USERNAME || commander.grafanaUsername || "admin";
const grafanaPassword = process.env.GRAFANA_PASSWORD || commander.grafanaPassword || "";
const grafanaUri = `${grafanaProtocol}://${grafanaUsername}:${grafanaPassword}@${grafanaHost}`;

const credentialsPath = process.env.GOOGLE_CREDENTIALS || commander.googleCredentials || ".credentials.json";
const googleAdminEmail = process.env.GOOGLE_ADMIN_EMAIL || commander.googleAdminEmail || "";
const rules = process.env.RULES || commander.rules || [];
const staticRules = process.env.STATIC_RULES || commander.staticRules || [];
const mode = process.env.MODE || commander.mode || "sync";
const excludeRole = process.env.EXCLUDE_ROLE || commander.excludeRole || "";

const interval = process.env.INTERVAL || commander.interval || 24 * 60 * 60 * 1000;
const metricsInterval = collectDefaultMetrics();
const success = new Counter({
    help: "Successful grafana gsuite sync counter",
    name: "grafana_gsuite_sync_success",
});
const fail = new Counter({
    help: "Unsuccessful grafana gsuite sync counter",
    name: "grafana_gsuite_sync_fail",
});

const getGoogleApiClient = async () => {
    if (this.service && this.client) {
        return;
    }
    try {
        logger.debug("Get google api client");
        const content = await readFileAsync(credentialsPath);
        const credentials = JSON.parse(content.toString());
        const client = auth.fromJSON(credentials);
        client.subject = googleAdminEmail;
        client.scopes = [
            "https://www.googleapis.com/auth/admin.directory.group.member.readonly",
            "https://www.googleapis.com/auth/admin.directory.group.readonly",
        ];
        await client.authorize();
        this.client = client;
        this.service = google.admin("directory_v1");
    }
    catch(e){
        logger.error(e);
    }
};

const getGroupMembers = async (email) => {
    if(!this.service || !this.client){
        logger.debug("The google api is not configured.");
        return [];
    }
    await getGoogleApiClient();
    const response = await this.service.members.list({
        auth: this.client,
        groupKey: email,
    });

    if (response.status !== 200 || !response.data || !response.data.members) {
        throw new Error("Failed to get members list.");
    }
    let members = [];
    await Promise.all(response.data.members.filter(m => m.email).map(async (member) => {
        if (member.type === "GROUP"){
            const subMembers = await getGroupMembers(member.email);
            members = members.concat(subMembers);
        } else {
            members.push(member.email);
        }
    }));
    return members;
};

const getGrafanaOrgId = async (name) => {
    try {
        logger.debug({name}, "Get grafana organisation by name.");
        const response = await request({
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json: true,
            uri: `${grafanaUri}/api/orgs/name/${name}`,
        });
        logger.debug({ name, response }, "Got grafana organisation by name.");
        if (!response.id) {
            throw new Error(`Could not get grafana orgatiosation by name ${name}`);
        }
        return response.id;
    } catch(e){
        logger.error({name}, e);
    }
};

const getGrafanaOrgUsers = async (orgId) => {
    try {
        logger.debug({ orgId }, "Get grafana organisation users.");
        const response = await request({
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json: true,
            uri: `${grafanaUri}/api/orgs/${orgId}/users`,
        });
        logger.debug({ orgId, response }, "Got grafana organisation users.");
        if (response.constructor !== Array) {
            return [];
        }
        return response.filter(m => m.email && m.email !== "admin@localhost").map(m => m.email);
    } catch (e) {
        logger.error({ orgId }, e);
    }
};

const getGrafanaUserId = async (email) => {
    try {
        logger.debug({ email }, "Get grafana user id.");
        const response = await request({
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json: true,
            uri: `${grafanaUri}/api/users/lookup?loginOrEmail=${email}`,
        });
        logger.debug({ email, response }, "Got grafana user id.");
        if (response.constructor !== Object) {
            throw new Error(`Could not get user by email: ${email}`);
        }
        return response.id;
    } catch (e) {
        logger.error({ email }, e);
    }
};

const getGrafanaUserRole = async (userId, orgId) => {
    try {
        logger.debug({ userId }, "Get grafana user.");
        const response = await request({
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json: true,
            uri: `${grafanaUri}/api/users/${userId}/orgs`,
        });
        logger.debug({ userId, response }, "Got grafana user.");
        if (response.constructor !== Array) {
            throw new Error(`Could not get user: ${userId}`);
        }
        const userOrgs = response.filter(u => u.orgId.toString() === orgId.toString());
        if (!userOrgs || userOrgs.length !== 1){
            return "";
        }
        return userOrgs[0].role;
    } catch (e) {
        logger.error({ userId }, e);
    }
};

const createGrafanaUser = async (orgId, email, role) => {
    // Only works if the user already signed up e.g. Google Auth
    try {
        logger.debug({ orgId, email, role }, "Create grafana user.");
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
            uri: `${grafanaUri}/api/orgs/${orgId}/users`,
        });
        logger.debug({ orgId, email, role, response }, "Created grafana organisation user.");
        return response;
    } catch (e) {
        logger.debug({ orgId, email, role }, e);
    }
};

const updateGrafanaUser = async (orgId, userId, role) => {
    try {
        logger.debug({ orgId, userId, role }, "Update grafana user.");
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
            uri: `${grafanaUri}/api/orgs/${orgId}/users/${userId}`,
        });
        logger.debug({ orgId, userId, role, response }, "Updated grafana user.");
        return response;
    } catch (e) {
        logger.error({ orgId, userId, role }, e);
    }
};

const deleteGrafanaUser = async (orgId, userId) => {
    try {
        logger.debug({
            orgId,
            userId,
        }, "Delete grafana user.");
        const response = await request({
            method: "DELETE",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json: true,
            uri: `${grafanaUri}/api/orgs/${orgId}/users/${userId}`,
        });
        logger.debug({ orgId, userId, response }, "Delete grafana user.");
        return response;
    } catch (e) {
        logger.error({ orgId, userId }, e);
    }
};

let updateRunning = false;

const sync = async () => {
    try {
        if (updateRunning) {
            logger.debug("Update is already running. Skipping...");
            return;
        }
        logger.info("Start sync process");
        updateRunning = true;
        const grafanaMembers = {}; // { orgId: ["email1","email2"]}
        const googleMembers = {}; // { orgId: ["email1","email2"]}

        // Build grafana and google users cache
        await Promise.all(rules.map(async (rule) => {
            try {
                const groupEmail = rule.split(":")[0];
                const orgName = rule.split(":")[1];
                const role = rule.split(":")[2];
                if (!groupEmail || !orgName || !role) {
                    throw new Error("Email or organization name or role missing.");
                }

                const orgId = await getGrafanaOrgId(orgName);
                if (!orgId) {
                    throw new Error("Could not get grafana organisation");
                }
                const uniqueId = `${orgId}:${role}`;
                grafanaMembers[uniqueId] = (grafanaMembers[uniqueId] || []).concat(await getGrafanaOrgUsers(orgId));

                await getGoogleApiClient();
                googleMembers[uniqueId] = (googleMembers[uniqueId] || []).concat(await getGroupMembers(groupEmail));

                success.inc();

            } catch (e) {
                fail.inc();
                logger.error(e);
            }
        }));

        logger.debug(googleMembers, "Google members map before create/update")
        logger.debug(googleMembers, "Grafana members map before create/update")

        // create or update all google users in grafana
        await Promise.all(Object.keys(googleMembers).map(async (uniqueId) => {
            const emails = googleMembers[uniqueId];
            const orgId = uniqueId.split(":")[0];
            const role = uniqueId.split(":")[1];
            await Promise.all(emails.map(async (email) => {
                try {
                    logger.info({ email, orgId, role }, "Sync gsuite rule");
                    const userId = await getGrafanaUserId(email);
                    if (userId) {
                        if (!grafanaMembers[uniqueId].includes(email)) {
                            await createGrafanaUser(orgId, email, role);
                        } else {
                            await updateGrafanaUser(orgId, userId, role);
                        }
                    }
                } catch (e) {
                    logger.error(e);
                }
                finally {
                    logger.debug(`Remove user ${email} from sync map.`);
                    grafanaMembers[uniqueId] = grafanaMembers[uniqueId].filter(e => e !== email);
                }
            }));
        }));

        logger.debug(googleMembers, "Google members map before delete")
        logger.debug(googleMembers, "Grafana members map before delete")

        // delete users which are not in google groups
        if (mode === "sync") {
            await Promise.all(Object.keys(grafanaMembers).map(async (uniqueId) => {
                const emails = grafanaMembers[uniqueId];
                const orgId = uniqueId.split(":")[0];
                await Promise.all(emails.map(async (email) => {
                    const userId = await getGrafanaUserId(email);
                    if (userId) {
                        const userRole = await getGrafanaUserRole(userId, orgId);
                        if (excludeRole !== userRole) {
                            await deleteGrafanaUser(orgId, userId);
                        }
                    }
                }));
            }));
        }

        // create or update static users
        await Promise.all(staticRules.map(async (rule) => {
            const email = rule.split(":")[0];
            const orgName = rule.split(":")[1];
            const role = rule.split(":")[2];
            if (!email || !orgName || !role) {
                throw new Error("Email or organization name or role missing.");
            }
            const orgId = await getGrafanaOrgId(orgName);
            if (!orgId) {
                throw new Error("Could not get grafana organisation");
            }
            logger.info({ email, orgId, role }, "Sync static rule");
            const uniqueId = `${orgId}:${role}`;
            try {
                const userId = await getGrafanaUserId(email);
                if (userId) {
                    try {
                        await createGrafanaUser(orgId, email, role);
                    }catch(e){
                        await updateGrafanaUser(orgId, userId, role);
                    }
                }
            } catch (e) {
                logger.error(e);
            }
            finally {
                if (grafanaMembers[uniqueId]) {
                    logger.debug(`Remove user ${email} from sync map.`);
                    grafanaMembers[uniqueId] = grafanaMembers[uniqueId].filter(e => e !== email);
                }
            }
        }));

        logger.info("End sync process");
        updateRunning = false;
    } catch (e) {
        fail.inc();
        logger.error(e);
        updateRunning = false;
    }
};

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
    logger.info(`Server listening on port ${port}!`);
    sync();
});

const updateInterval = setInterval(sync, parseInt(interval, 10));

process.on("SIGTERM", () => {
    clearInterval(updateInterval);
    clearInterval(metricsInterval);

    server.close((err) => {
        if (err) {
            logger.error(err);
            process.exit(1);
        }

        process.exit(0);
    });
});
