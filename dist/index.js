#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var commander = require("commander");
var express = require("express");
var fs_1 = require("fs");
var google_auth_library_1 = require("google-auth-library");
var googleapis_1 = require("googleapis");
var pino = require("pino");
var prom_client_1 = require("prom-client");
var request = require("request-promise");
var util_1 = require("util");
commander
    .option("-p, --port [port]", "Server port")
    .option("-P, --grafana-protocol [grafana-protocol]", "Grafana API protocol", /^(http|https)$/i)
    .option("-H, --grafana-host [grafana-host]", "Grafana API host")
    .option("-U, --grafana-username [grafana-username]", "Grafana API admin username", "")
    .option("-P, --grafana-password <grafana-password>", "Grafana API admin password", "")
    .option("-C, --google-credentials <google-credentials>", "Path to google admin directory credentials file", "")
    .option("-A, --google-admin-email <google-admin-email>", "The Google Admin Email for subject", "")
    .option("-r, --rules <rules>", "Comma separated rules to sync <google group email>:<grafana org name>:<users role> \n\t" +
    "(e.g. 'group@test.com:Main:Admin')", function (val) { return val.split(","); })
    .option("-s, --static-rules <static-rules>", "Comma separated static rules to create <email>:<grafana org name>:<user role> \n\t" +
    "(e.g. 'user@test.com:Main:Viewer')", function (val) { return val.split(","); })
    .option("-l, --level [level]", "Log level", /^(debug|info|warn|error|fatal)$/i)
    .option("-m, --mode [mode]", "How users are sychronized between google and grafana: sync or upsert-only", /^(sync|upsert-only)$/i)
    .option("-e, --exclude-role [exclude-role]", "Exclude role to delete", /^(Admin|Editor|Viewer)$/i)
    .option("-i, --interval [interval]", "Sync interval")
    .parse(process.argv);
var readFileAsync = util_1.promisify(fs_1.readFile);
var logLevel = process.env.LEVEL || commander.level || "info";
var logger = pino({
    prettyPrint: process.env.NODE_ENV !== "production",
    level: logLevel,
});
var app = express();
var port = process.env.PORT || commander.port || 5000;
var grafanaProtocol = process.env.GRAFANA_PROTOCOL || commander.grafanaProtocol || "http";
var grafanaHost = process.env.GRAFANA_HOST || commander.grafanaHost || "localhost:3000";
var grafanaUsername = process.env.GRAFANA_USERNAME || commander.grafanaUsername || "admin";
var grafanaPassword = process.env.GRAFANA_PASSWORD || commander.grafanaPassword || "";
var grafanaUri = grafanaProtocol + "://" + grafanaUsername + ":" + grafanaPassword + "@" + grafanaHost;
var credentialsPath = process.env.GOOGLE_CREDENTIALS || commander.googleCredentials || ".credentials.json";
var googleAdminEmail = process.env.GOOGLE_ADMIN_EMAIL || commander.googleAdminEmail || "";
var rules = process.env.RULES || commander.rules || [];
var staticRules = process.env.STATIC_RULES || commander.staticRules || [];
var mode = process.env.MODE || commander.mode || "sync";
var excludeRole = process.env.EXCLUDE_ROLE || commander.excludeRole || "";
var interval = process.env.INTERVAL || commander.interval || 24 * 60 * 60 * 1000;
var metricsInterval = prom_client_1.collectDefaultMetrics();
var success = new prom_client_1.Counter({
    help: "Successful grafana gsuite sync counter",
    name: "grafana_gsuite_sync_success",
});
var fail = new prom_client_1.Counter({
    help: "Unsuccessful grafana gsuite sync counter",
    name: "grafana_gsuite_sync_fail",
});
var getGoogleApiClient = function () { return __awaiter(_this, void 0, void 0, function () {
    var content, credentials, client, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (this.service && this.client) {
                    return [2];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                logger.debug("Get google api client");
                return [4, readFileAsync(credentialsPath)];
            case 2:
                content = _a.sent();
                credentials = JSON.parse(content.toString());
                client = google_auth_library_1.auth.fromJSON(credentials, {});
                client.subject = googleAdminEmail;
                client.scopes = [
                    "https://www.googleapis.com/auth/admin.directory.group.member.readonly",
                    "https://www.googleapis.com/auth/admin.directory.group.readonly",
                ];
                return [4, client.authorize()];
            case 3:
                _a.sent();
                this.client = client;
                this.service = googleapis_1.google.admin("directory_v1");
                return [3, 5];
            case 4:
                e_1 = _a.sent();
                logger.error(e_1);
                return [3, 5];
            case 5: return [2];
        }
    });
}); };
var getGroupMembers = function (email) { return __awaiter(_this, void 0, void 0, function () {
    var response, members;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!this.service || !this.client) {
                    logger.debug("The google api is not configured.");
                    return [2, []];
                }
                return [4, getGoogleApiClient()];
            case 1:
                _a.sent();
                return [4, this.service.members.list({
                        auth: this.client,
                        groupKey: email,
                    })];
            case 2:
                response = _a.sent();
                if (response.status !== 200 || !response.data || !response.data.members) {
                    throw new Error("Failed to get members list.");
                }
                members = [];
                return [4, Promise.all(response.data.members.filter(function (m) { return m.email; }).map(function (member) { return __awaiter(_this, void 0, void 0, function () {
                        var subMembers;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(member.type === "GROUP")) return [3, 2];
                                    return [4, getGroupMembers(member.email)];
                                case 1:
                                    subMembers = _a.sent();
                                    members = members.concat(subMembers);
                                    return [3, 3];
                                case 2:
                                    members.push(member.email);
                                    _a.label = 3;
                                case 3: return [2];
                            }
                        });
                    }); }))];
            case 3:
                _a.sent();
                return [2, members];
        }
    });
}); };
var getGrafanaOrgId = function (name) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({ name: name }, "Get grafana organisation by name.");
                return [4, request({
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json: true,
                        uri: grafanaUri + "/api/orgs/name/" + name,
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ name: name, response: response }, "Got grafana organisation by name.");
                if (!response.id) {
                    throw new Error("Could not get grafana orgatiosation by name " + name);
                }
                return [2, response.id];
            case 2:
                e_2 = _a.sent();
                logger.error({ name: name }, e_2);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var getGrafanaOrgUsers = function (orgId, role) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({ orgId: orgId }, "Get grafana organisation users.");
                return [4, request({
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json: true,
                        uri: grafanaUri + "/api/orgs/" + orgId + "/users",
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ orgId: orgId, response: response }, "Got grafana organisation users.");
                if (response.constructor !== Array) {
                    return [2, []];
                }
                return [2, response
                        .filter(function (m) { return m.email && m.email !== "admin@localhost"; })
                        .filter(function (m) { return m.role && m.role === role; })
                        .map(function (m) { return m.emai; })];
            case 2:
                e_3 = _a.sent();
                logger.error({ orgId: orgId }, e_3);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var getGrafanaUserId = function (email) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({ email: email }, "Get grafana user id.");
                return [4, request({
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json: true,
                        uri: grafanaUri + "/api/users/lookup?loginOrEmail=" + email,
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ email: email, response: response }, "Got grafana user id.");
                if (response.constructor !== Object) {
                    throw new Error("Could not get user by email: " + email);
                }
                return [2, response.id];
            case 2:
                e_4 = _a.sent();
                logger.error({ email: email }, e_4);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var getGrafanaUserRole = function (userId, orgId, email) { return __awaiter(_this, void 0, void 0, function () {
    var response, userOrgs, role, e_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4, request({
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json: true,
                        uri: grafanaUri + "/api/users/" + userId + "/orgs",
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ userId: userId, email: email, response: response }, "Got grafana user.");
                if (response.constructor !== Array) {
                    throw new Error("Could not get user: " + userId);
                }
                userOrgs = response.filter(function (u) { return u.orgId.toString() === orgId.toString(); });
                if (!userOrgs || userOrgs.length !== 1) {
                    return [2, ""];
                }
                role = userOrgs[0].role;
                logger.debug({ userId: userId, email: email, role: role }, "Got grafana user role.");
                return [2, role];
            case 2:
                e_5 = _a.sent();
                logger.error({ userId: userId }, e_5);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var createGrafanaUser = function (orgId, email, role) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({ orgId: orgId, email: email, role: role }, "Create grafana user.");
                return [4, request({
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        body: {
                            loginOrEmail: email,
                            role: role,
                        },
                        json: true,
                        uri: grafanaUri + "/api/orgs/" + orgId + "/users",
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ orgId: orgId, email: email, role: role, response: response }, "Created grafana organisation user.");
                return [2, response];
            case 2:
                e_6 = _a.sent();
                logger.debug({ orgId: orgId, email: email, role: role }, e_6);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var updateGrafanaUser = function (orgId, userId, role) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({ orgId: orgId, userId: userId, role: role }, "Update grafana user.");
                return [4, request({
                        method: "PATCH",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        body: {
                            role: role,
                        },
                        json: true,
                        uri: grafanaUri + "/api/orgs/" + orgId + "/users/" + userId,
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ orgId: orgId, userId: userId, role: role, response: response }, "Updated grafana user.");
                return [2, response];
            case 2:
                e_7 = _a.sent();
                logger.error({ orgId: orgId, userId: userId, role: role }, e_7);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var deleteGrafanaUser = function (orgId, userId, email) { return __awaiter(_this, void 0, void 0, function () {
    var response, e_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                logger.debug({
                    orgId: orgId,
                    userId: userId,
                    email: email,
                }, "Delete grafana user.");
                return [4, request({
                        method: "DELETE",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json: true,
                        uri: grafanaUri + "/api/orgs/" + orgId + "/users/" + userId,
                    })];
            case 1:
                response = _a.sent();
                logger.debug({ orgId: orgId, userId: userId, response: response }, "Delete grafana user.");
                return [2, response];
            case 2:
                e_8 = _a.sent();
                logger.error({ orgId: orgId, userId: userId }, e_8);
                return [3, 3];
            case 3: return [2];
        }
    });
}); };
var updateRunning = false;
var sync = function () { return __awaiter(_this, void 0, void 0, function () {
    var grafanaMembers_1, googleMembers_1, e_9;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                if (updateRunning) {
                    logger.debug("Update is already running. Skipping...");
                    return [2];
                }
                logger.info("Start sync process");
                updateRunning = true;
                grafanaMembers_1 = {};
                googleMembers_1 = {};
                return [4, Promise.all(rules.map(function (rule) { return __awaiter(_this, void 0, void 0, function () {
                        var groupEmail, orgName, role, orgId, uniqueId, _a, _b, _c, _d, _e, _f, _g, _h, e_10;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    _j.trys.push([0, 5, , 6]);
                                    groupEmail = rule.split(":")[0];
                                    orgName = rule.split(":")[1];
                                    role = rule.split(":")[2];
                                    if (!groupEmail || !orgName || !role) {
                                        throw new Error("Email or organization name or role missing.");
                                    }
                                    return [4, getGrafanaOrgId(orgName)];
                                case 1:
                                    orgId = _j.sent();
                                    if (!orgId) {
                                        throw new Error("Could not get grafana organisation");
                                    }
                                    uniqueId = orgId + ":" + role;
                                    _a = grafanaMembers_1;
                                    _b = uniqueId;
                                    _d = (_c = (grafanaMembers_1[uniqueId] || [])).concat;
                                    return [4, getGrafanaOrgUsers(orgId, role)];
                                case 2:
                                    _a[_b] = _d.apply(_c, [_j.sent()]);
                                    return [4, getGoogleApiClient()];
                                case 3:
                                    _j.sent();
                                    _e = googleMembers_1;
                                    _f = uniqueId;
                                    _h = (_g = (googleMembers_1[uniqueId] || [])).concat;
                                    return [4, getGroupMembers(groupEmail)];
                                case 4:
                                    _e[_f] = _h.apply(_g, [_j.sent()]);
                                    success.inc();
                                    return [3, 6];
                                case 5:
                                    e_10 = _j.sent();
                                    fail.inc();
                                    logger.error(e_10);
                                    return [3, 6];
                                case 6: return [2];
                            }
                        });
                    }); }))];
            case 1:
                _a.sent();
                logger.debug(googleMembers_1, "Google members map before create/update");
                logger.debug(grafanaMembers_1, "Grafana members map before create/update");
                return [4, Promise.all(Object.keys(googleMembers_1).map(function (uniqueId) { return __awaiter(_this, void 0, void 0, function () {
                        var emails, orgId, role;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    emails = googleMembers_1[uniqueId];
                                    orgId = uniqueId.split(":")[0];
                                    role = uniqueId.split(":")[1];
                                    return [4, Promise.all(emails.map(function (email) { return __awaiter(_this, void 0, void 0, function () {
                                            var userId, e_11;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        _a.trys.push([0, 6, 7, 8]);
                                                        logger.info({ email: email, orgId: orgId, role: role }, "Sync gsuite rule");
                                                        return [4, getGrafanaUserId(email)];
                                                    case 1:
                                                        userId = _a.sent();
                                                        if (!userId) return [3, 5];
                                                        if (!!grafanaMembers_1[uniqueId].find(function (e) { return e === email; })) return [3, 3];
                                                        return [4, createGrafanaUser(orgId, email, role)];
                                                    case 2:
                                                        _a.sent();
                                                        return [3, 5];
                                                    case 3: return [4, updateGrafanaUser(orgId, userId, role)];
                                                    case 4:
                                                        _a.sent();
                                                        _a.label = 5;
                                                    case 5: return [3, 8];
                                                    case 6:
                                                        e_11 = _a.sent();
                                                        logger.error(e_11);
                                                        return [3, 8];
                                                    case 7:
                                                        logger.debug("Remove user " + email + " from sync map.");
                                                        grafanaMembers_1[uniqueId] = grafanaMembers_1[uniqueId].filter(function (e) { return e !== email; });
                                                        return [7];
                                                    case 8: return [2];
                                                }
                                            });
                                        }); }))];
                                case 1:
                                    _a.sent();
                                    return [2];
                            }
                        });
                    }); }))];
            case 2:
                _a.sent();
                logger.debug(googleMembers_1, "Google members map before delete");
                logger.debug(grafanaMembers_1, "Grafana members map before delete");
                if (!(mode === "sync")) return [3, 4];
                return [4, Promise.all(Object.keys(grafanaMembers_1).map(function (uniqueId) { return __awaiter(_this, void 0, void 0, function () {
                        var emails, orgId;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    emails = grafanaMembers_1[uniqueId];
                                    orgId = uniqueId.split(":")[0];
                                    return [4, Promise.all(emails.map(function (email) { return __awaiter(_this, void 0, void 0, function () {
                                            var userId, userRole;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4, getGrafanaUserId(email)];
                                                    case 1:
                                                        userId = _a.sent();
                                                        if (!userId) return [3, 4];
                                                        return [4, getGrafanaUserRole(userId, orgId, email)];
                                                    case 2:
                                                        userRole = _a.sent();
                                                        if (!(excludeRole !== userRole && !googleMembers_1[uniqueId].find(function (e) { return e === email; }))) return [3, 4];
                                                        return [4, deleteGrafanaUser(orgId, userId, email)];
                                                    case 3:
                                                        _a.sent();
                                                        _a.label = 4;
                                                    case 4: return [2];
                                                }
                                            });
                                        }); }))];
                                case 1:
                                    _a.sent();
                                    return [2];
                            }
                        });
                    }); }))];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [4, Promise.all(staticRules.map(function (rule) { return __awaiter(_this, void 0, void 0, function () {
                    var email, orgName, role, orgId, uniqueId, userId, e_12, e_13;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                email = rule.split(":")[0];
                                orgName = rule.split(":")[1];
                                role = rule.split(":")[2];
                                if (!email || !orgName || !role) {
                                    throw new Error("Email or organization name or role missing.");
                                }
                                return [4, getGrafanaOrgId(orgName)];
                            case 1:
                                orgId = _a.sent();
                                if (!orgId) {
                                    throw new Error("Could not get grafana organisation");
                                }
                                logger.info({ email: email, orgId: orgId, role: role }, "Sync static rule");
                                uniqueId = orgId + ":" + role;
                                _a.label = 2;
                            case 2:
                                _a.trys.push([2, 9, 10, 11]);
                                return [4, getGrafanaUserId(email)];
                            case 3:
                                userId = _a.sent();
                                if (!userId) return [3, 8];
                                _a.label = 4;
                            case 4:
                                _a.trys.push([4, 6, , 8]);
                                return [4, createGrafanaUser(orgId, email, role)];
                            case 5:
                                _a.sent();
                                return [3, 8];
                            case 6:
                                e_12 = _a.sent();
                                return [4, updateGrafanaUser(orgId, userId, role)];
                            case 7:
                                _a.sent();
                                return [3, 8];
                            case 8: return [3, 11];
                            case 9:
                                e_13 = _a.sent();
                                logger.error(e_13);
                                return [3, 11];
                            case 10:
                                if (grafanaMembers_1[uniqueId]) {
                                    logger.debug("Remove user " + email + " from sync map.");
                                    grafanaMembers_1[uniqueId] = grafanaMembers_1[uniqueId].filter(function (e) { return e !== email; });
                                }
                                return [7];
                            case 11: return [2];
                        }
                    });
                }); }))];
            case 5:
                _a.sent();
                logger.info("End sync process");
                updateRunning = false;
                return [3, 7];
            case 6:
                e_9 = _a.sent();
                fail.inc();
                logger.error(e_9);
                updateRunning = false;
                return [3, 7];
            case 7: return [2];
        }
    });
}); };
app.get("/healthz", function (req, res) {
    res.status(200).json({ status: "UP" });
});
app.get("/metrics", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            res.set("Content-Type", prom_client_1.register.contentType);
            res.end(prom_client_1.register.metrics());
        }
        catch (e) {
            res.status(503).json({ error: e.toString() });
        }
        return [2];
    });
}); });
var server = app.listen(port, function () {
    logger.info("Server listening on port " + port + "!");
    sync();
});
var updateInterval = setInterval(sync, parseInt(interval, 10));
process.on("SIGTERM", function () {
    clearInterval(updateInterval);
    clearInterval(metricsInterval);
    server.close(function (err) {
        if (err) {
            logger.error(err);
            process.exit(1);
        }
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map