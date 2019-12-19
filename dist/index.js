#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
var readFileAsync = util_1.promisify(fs_1.readFile);
var collect = function (value, previous) {
    var splitValue = Array.isArray(value) ? value : value.split(",");
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
    .option("-r, --rules <rules>", "Comma separated or repeatable rules to sync <google group email>:<grafana org name>:<users role> \n\t" +
    "(e.g. 'group@test.com:Main:Admin')", collect, [])
    .option("-s, --static-rules <static-rules>", "Comma separated or repeatable static rules to create <email>:<grafana org name>:<user role> \n\t" +
    "(e.g. 'user@test.com:Main:Viewer')", collect, [])
    .option("-l, --level [level]", "Log level", /^(debug|info|warn|error|fatal)$/i)
    .option("-m, --mode [mode]", "How users are sychronized between google and grafana: sync or upsert-only", /^(sync|upsert-only)$/i)
    .option("-e, --exclude-role [exclude-role]", "Exclude role to delete", /^(Admin|Editor|Viewer)$/i)
    .option("-i, --interval [interval]", "Sync interval")
    .parse(process.argv);
var app = express();
var port = process.env.PORT || commander.port || 5000;
var GrafanaSync = (function () {
    function GrafanaSync() {
        var _this = this;
        this.getGoogleApiClient = function () { return __awaiter(_this, void 0, void 0, function () {
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
                        this.logger.debug("Get google api client");
                        return [4, readFileAsync(this.credentialsPath)];
                    case 2:
                        content = _a.sent();
                        credentials = JSON.parse(content.toString());
                        client = google_auth_library_1.auth.fromJSON(credentials, {});
                        client.subject = this.googleAdminEmail;
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
                        this.logger.error("Failed to get google api client", { error: this.formatError(e_1) });
                        return [3, 5];
                    case 5: return [2];
                }
            });
        }); };
        this.getGroupMembers = function (email, nextPageToken) {
            if (nextPageToken === void 0) { nextPageToken = ""; }
            return __awaiter(_this, void 0, void 0, function () {
                var options, response, members_1, pageMembers, e_2;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            return [4, this.getGoogleApiClient()];
                        case 1:
                            _a.sent();
                            if (!this.service || !this.client) {
                                this.logger.debug("The google api is not configured.");
                                return [2, []];
                            }
                            options = {
                                auth: this.client,
                                groupKey: email,
                            };
                            if (nextPageToken) {
                                options.pageToken = nextPageToken;
                            }
                            return [4, this.service.members.list(options)];
                        case 2:
                            response = _a.sent();
                            if (response.status !== 200 || !response.data || !response.data.members) {
                                throw new Error("Failed to get members list.");
                            }
                            this.logger.debug("Got google response members", { members: response.data.members.map(function (m) { return m.email; }) });
                            members_1 = [];
                            return [4, Promise.all(response.data.members.filter(function (m) { return m.email; }).map(function (member) { return __awaiter(_this, void 0, void 0, function () {
                                    var subMembers;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                if (!(member.type === "GROUP")) return [3, 2];
                                                return [4, this.getGroupMembers(member.email)];
                                            case 1:
                                                subMembers = _a.sent();
                                                members_1 = members_1.concat(subMembers);
                                                return [3, 3];
                                            case 2:
                                                members_1.push(member.email);
                                                _a.label = 3;
                                            case 3: return [2];
                                        }
                                    });
                                }); }))];
                        case 3:
                            _a.sent();
                            if (!response.data.nextPageToken) return [3, 5];
                            this.logger.debug("Find next page");
                            return [4, this.getGroupMembers(email, response.data.nextPageToken)];
                        case 4:
                            pageMembers = _a.sent();
                            this.logger.debug("Got google page members", { members: pageMembers });
                            members_1 = members_1.concat(pageMembers);
                            _a.label = 5;
                        case 5:
                            this.logger.debug({ members: members_1 }, "Got google members");
                            return [2, members_1];
                        case 6:
                            e_2 = _a.sent();
                            this.logger.error({ error: this.formatError(e_2) }, "Failed to get google members");
                            return [2, []];
                        case 7: return [2];
                    }
                });
            });
        };
        this.getGrafanaOrgId = function (name) { return __awaiter(_this, void 0, void 0, function () {
            var response, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.debug({ name: name }, "Get grafana organization by name.");
                        return [4, request({
                                headers: {
                                    "Accept": "application/json",
                                    "Content-Type": "application/json",
                                },
                                json: true,
                                uri: this.grafanaUri + "/api/orgs/name/" + name,
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ name: name, response: response }, "Got grafana organization by name.");
                        if (!response.id) {
                            throw new Error("Could not get grafana organization by name " + name);
                        }
                        return [2, response.id];
                    case 2:
                        e_3 = _a.sent();
                        this.logger.error("Failed to get grafana org id", { name: name, error: this.formatError(e_3) });
                        return [2, ""];
                    case 3: return [2];
                }
            });
        }); };
        this.getGrafanaOrgUsers = function (orgId, role) { return __awaiter(_this, void 0, void 0, function () {
            var response, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.debug({ orgId: orgId }, "Get grafana organization users.");
                        return [4, request({
                                headers: {
                                    "Accept": "application/json",
                                    "Content-Type": "application/json",
                                },
                                json: true,
                                uri: this.grafanaUri + "/api/orgs/" + orgId + "/users",
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ orgId: orgId, users: response.map(function (r) { return r.email; }) }, "Got grafana organization users.");
                        if (response.constructor !== Array) {
                            return [2, []];
                        }
                        return [2, response
                                .filter(function (m) { return m.email && m.email !== "admin@localhost"; })
                                .filter(function (m) { return m.role && m.role === role; })
                                .map(function (m) { return m.email; })];
                    case 2:
                        e_4 = _a.sent();
                        this.logger.error("Failed to get grafana users", { orgId: orgId, error: this.formatError(e_4) });
                        return [2, []];
                    case 3: return [2];
                }
            });
        }); };
        this.getGrafanaUserId = function (email) { return __awaiter(_this, void 0, void 0, function () {
            var response, e_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.debug({ email: email }, "Get grafana user id.");
                        return [4, request({
                                headers: {
                                    "Accept": "application/json",
                                    "Content-Type": "application/json",
                                },
                                json: true,
                                uri: this.grafanaUri + "/api/users/lookup?loginOrEmail=" + email,
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ email: email, response: response }, "Got grafana user id.");
                        if (response.constructor !== Object) {
                            throw new Error("Could not get user by email: " + email);
                        }
                        return [2, response.id];
                    case 2:
                        e_5 = _a.sent();
                        this.logger.error("Failed to get grafana user by email", { email: email, error: this.formatError(e_5) });
                        return [2, ""];
                    case 3: return [2];
                }
            });
        }); };
        this.getGrafanaUserRole = function (userId, orgId, email) { return __awaiter(_this, void 0, void 0, function () {
            var response, userOrgs, role, e_6;
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
                                uri: this.grafanaUri + "/api/users/" + userId + "/orgs",
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ userId: userId, email: email, response: response }, "Got grafana user.");
                        if (response.constructor !== Array) {
                            throw new Error("Could not get user: " + userId);
                        }
                        userOrgs = response.filter(function (u) { return u.orgId.toString() === orgId.toString(); });
                        if (!userOrgs || userOrgs.length !== 1) {
                            return [2, ""];
                        }
                        role = userOrgs[0].role;
                        this.logger.debug({ userId: userId, email: email, role: role }, "Got grafana user role.");
                        return [2, role];
                    case 2:
                        e_6 = _a.sent();
                        this.logger.error("Failed to get grafana user role", { userId: userId, error: this.formatError(e_6) });
                        return [2, ""];
                    case 3: return [2];
                }
            });
        }); };
        this.createGrafanaUser = function (orgId, email, role) { return __awaiter(_this, void 0, void 0, function () {
            var response, e_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.debug({ orgId: orgId, email: email, role: role }, "Create grafana user.");
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
                                uri: this.grafanaUri + "/api/orgs/" + orgId + "/users",
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ orgId: orgId, email: email, role: role, response: response }, "Created grafana organization user.");
                        return [2, response];
                    case 2:
                        e_7 = _a.sent();
                        this.logger.error("Failed to create grafana user", { orgId: orgId, email: email, role: role, error: this.formatError(e_7) });
                        return [3, 3];
                    case 3: return [2];
                }
            });
        }); };
        this.deleteGrafanaUser = function (orgId, userId, email) { return __awaiter(_this, void 0, void 0, function () {
            var response, e_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.debug({
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
                                uri: this.grafanaUri + "/api/orgs/" + orgId + "/users/" + userId,
                            }).catch(function (err) { return err.response; })];
                    case 1:
                        response = _a.sent();
                        this.logger.debug({ orgId: orgId, userId: userId, response: response }, "Delete grafana user.");
                        return [2, response];
                    case 2:
                        e_8 = _a.sent();
                        this.logger.error("Failed to delete grafana user", { orgId: orgId, userId: userId, error: this.formatError(e_8) });
                        return [3, 3];
                    case 3: return [2];
                }
            });
        }); };
        this.formatError = function (err) {
            if (!err) {
                return "";
            }
            if (err && err.error) {
                return err.error;
            }
            if (err && err.message) {
                return err.message;
            }
            return "";
        };
        this.sync = function () { return __awaiter(_this, void 0, void 0, function () {
            var e_9;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        if (this.updateRunning) {
                            this.logger.debug("Update is already running. Skipping...");
                            return [2];
                        }
                        this.logger.info("Start sync process");
                        this.updateRunning = true;
                        return [4, Promise.all(this.rules.map(function (rule) { return __awaiter(_this, void 0, void 0, function () {
                                var groupEmail, orgName, role, orgId, uniqueId, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, e_10;
                                return __generator(this, function (_l) {
                                    switch (_l.label) {
                                        case 0:
                                            _l.trys.push([0, 4, , 5]);
                                            groupEmail = rule.split(":")[0];
                                            orgName = rule.split(":")[1];
                                            role = rule.split(":")[2];
                                            if (!groupEmail || !orgName || !role) {
                                                throw new Error("Email or organization name or role missing.");
                                            }
                                            return [4, this.getGrafanaOrgId(orgName)];
                                        case 1:
                                            orgId = _l.sent();
                                            if (!orgId) {
                                                throw new Error("Could not get grafana organization");
                                            }
                                            uniqueId = orgId + ":" + role;
                                            _b = (_a = this.grafanaMembers).set;
                                            _c = [uniqueId];
                                            _e = (_d = (this.grafanaMembers.get(uniqueId) || [])).concat;
                                            return [4, this.getGrafanaOrgUsers(orgId, role)];
                                        case 2:
                                            _b.apply(_a, _c.concat([_e.apply(_d, [_l.sent()])]));
                                            _g = (_f = this.googleMembers).set;
                                            _h = [uniqueId];
                                            _k = (_j = (this.googleMembers.get(uniqueId) || [])).concat;
                                            return [4, this.getGroupMembers(groupEmail)];
                                        case 3:
                                            _g.apply(_f, _h.concat([_k.apply(_j, [_l.sent()])]));
                                            this.success.inc();
                                            return [3, 5];
                                        case 4:
                                            e_10 = _l.sent();
                                            this.fail.inc();
                                            this.logger.error("Failed to build grafana and google users cache", this.formatError(e_10));
                                            return [3, 5];
                                        case 5: return [2];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        this.logger.debug(this.googleMembers, "Google members map before create/update");
                        this.logger.debug(this.grafanaMembers, "Grafana members map before create/update");
                        return [4, Promise.all(Array.from(this.googleMembers.keys()).map(function (uniqueId) { return __awaiter(_this, void 0, void 0, function () {
                                var emails, orgId, role;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            emails = this.googleMembers.get(uniqueId);
                                            orgId = uniqueId.split(":")[0];
                                            role = uniqueId.split(":")[1];
                                            return [4, Promise.all(emails.map(function (email) { return __awaiter(_this, void 0, void 0, function () {
                                                    var userId, e_11;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                _a.trys.push([0, 6, 7, 8]);
                                                                this.logger.info({ email: email, orgId: orgId, role: role }, "Sync gsuite rule");
                                                                return [4, this.getGrafanaUserId(email)];
                                                            case 1:
                                                                userId = _a.sent();
                                                                if (!userId) return [3, 5];
                                                                if (!!this.grafanaMembers.get(uniqueId).find(function (e) { return e === email; })) return [3, 3];
                                                                return [4, this.createGrafanaUser(orgId, email, role)];
                                                            case 2:
                                                                _a.sent();
                                                                return [3, 5];
                                                            case 3: return [4, this.updateGrafanaUser(orgId, userId, role, email)];
                                                            case 4:
                                                                _a.sent();
                                                                _a.label = 5;
                                                            case 5: return [3, 8];
                                                            case 6:
                                                                e_11 = _a.sent();
                                                                this.logger.error("Failed to create or update all google users in grafana", this.formatError(e_11));
                                                                return [3, 8];
                                                            case 7:
                                                                this.logger.debug("Remove user " + email + " from sync map.");
                                                                this.grafanaMembers.set(uniqueId, this.grafanaMembers.get(uniqueId).filter(function (e) { return e !== email; }));
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
                        this.logger.debug(this.googleMembers, "Google members map before delete");
                        this.logger.debug(this.grafanaMembers, "Grafana members map before delete");
                        if (!(this.mode === "sync")) return [3, 4];
                        return [4, Promise.all(Array.from(this.grafanaMembers.keys()).map(function (uniqueId) { return __awaiter(_this, void 0, void 0, function () {
                                var emails, orgId;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            emails = this.grafanaMembers.get(uniqueId);
                                            orgId = uniqueId.split(":")[0];
                                            return [4, Promise.all(emails.map(function (email) { return __awaiter(_this, void 0, void 0, function () {
                                                    var userId, userRole;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4, this.getGrafanaUserId(email)];
                                                            case 1:
                                                                userId = _a.sent();
                                                                if (!userId) return [3, 4];
                                                                return [4, this.getGrafanaUserRole(userId, orgId, email)];
                                                            case 2:
                                                                userRole = _a.sent();
                                                                if (!(this.excludeRole !== userRole && !this.googleMembers.get(uniqueId).find(function (e) { return e === email; }))) return [3, 4];
                                                                return [4, this.deleteGrafanaUser(orgId, userId, email)];
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
                    case 4: return [4, Promise.all(this.staticRules.map(function (rule) { return __awaiter(_this, void 0, void 0, function () {
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
                                        return [4, this.getGrafanaOrgId(orgName)];
                                    case 1:
                                        orgId = _a.sent();
                                        if (!orgId) {
                                            throw new Error("Could not get grafana organization");
                                        }
                                        this.logger.info({ email: email, orgId: orgId, role: role }, "Sync static rule");
                                        uniqueId = orgId + ":" + role;
                                        _a.label = 2;
                                    case 2:
                                        _a.trys.push([2, 9, 10, 11]);
                                        return [4, this.getGrafanaUserId(email)];
                                    case 3:
                                        userId = _a.sent();
                                        if (!userId) return [3, 8];
                                        _a.label = 4;
                                    case 4:
                                        _a.trys.push([4, 6, , 8]);
                                        return [4, this.createGrafanaUser(orgId, email, role)];
                                    case 5:
                                        _a.sent();
                                        return [3, 8];
                                    case 6:
                                        e_12 = _a.sent();
                                        return [4, this.updateGrafanaUser(orgId, userId, role, email)];
                                    case 7:
                                        _a.sent();
                                        return [3, 8];
                                    case 8: return [3, 11];
                                    case 9:
                                        e_13 = _a.sent();
                                        this.logger.error("Failed to create or update static users", this.formatError(e_13));
                                        return [3, 11];
                                    case 10:
                                        if (this.grafanaMembers.get(uniqueId)) {
                                            this.logger.debug("Remove user " + email + " from sync map.");
                                            this.grafanaMembers.set(uniqueId, this.grafanaMembers.get(uniqueId).filter(function (e) { return e !== email; }));
                                        }
                                        return [7];
                                    case 11: return [2];
                                }
                            });
                        }); }))];
                    case 5:
                        _a.sent();
                        this.googleMembers.clear();
                        this.grafanaMembers.clear();
                        this.logger.info("End sync process");
                        this.updateRunning = false;
                        return [3, 7];
                    case 6:
                        e_9 = _a.sent();
                        this.fail.inc();
                        this.logger.error(this.formatError(e_9));
                        this.updateRunning = false;
                        return [3, 7];
                    case 7: return [2];
                }
            });
        }); };
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
        this.grafanaUri = this.grafanaProtocol + "://" + this.grafanaUsername + ":" + this.grafanaPassword + "@" + this.grafanaHost;
        this.credentialsPath = process.env.GOOGLE_CREDENTIALS || commander.googleCredentials || ".credentials.json";
        this.googleAdminEmail = process.env.GOOGLE_ADMIN_EMAIL || commander.googleAdminEmail || "";
        this.rules = process.env.RULES || commander.rules || [];
        this.staticRules = process.env.STATIC_RULES || commander.staticRules || [];
        this.mode = process.env.MODE || commander.mode || "sync";
        this.excludeRole = process.env.EXCLUDE_ROLE || commander.excludeRole || "";
        this.metricsInterval = prom_client_1.collectDefaultMetrics();
        this.success = new prom_client_1.Counter({
            help: "Successful grafana gsuite sync counter",
            name: "grafana_gsuite_sync_success",
        });
        this.fail = new prom_client_1.Counter({
            help: "Unsuccessful grafana gsuite sync counter",
            name: "grafana_gsuite_sync_fail",
        });
        this.grafanaMembers = new Map();
        this.googleMembers = new Map();
    }
    GrafanaSync.prototype.updateGrafanaUser = function (orgId, userId, role, email) {
        return __awaiter(this, void 0, void 0, function () {
            var oldRole, response, e_14;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4, this.getGrafanaUserRole(userId, orgId, email)];
                    case 1:
                        oldRole = _a.sent();
                        if (oldRole === role) {
                            this.logger.debug({ orgId: orgId, email: email, role: role }, "The role is already set, so skipping user update");
                            return [2];
                        }
                        if (oldRole === "Admin" && (role === "Editor" || role === "Viewer")) {
                            this.logger.debug({ orgId: orgId, email: email, role: role }, "The existing role is more powerful, so skipping user update");
                            return [2];
                        }
                        if (oldRole === "Editor" && role === "Viewer") {
                            this.logger.debug({ orgId: orgId, email: email, role: role }, "The existing role is more powerful, so skipping user update");
                            return [2];
                        }
                        this.logger.debug({ orgId: orgId, userId: userId, role: role }, "Updating grafana user.");
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
                                uri: this.grafanaUri + "/api/orgs/" + orgId + "/users/" + userId,
                            }).catch(function (err) { return err.response; })];
                    case 2:
                        response = _a.sent();
                        this.logger.debug({ orgId: orgId, userId: userId, role: role, response: response }, "Updated grafana user.");
                        return [2, response];
                    case 3:
                        e_14 = _a.sent();
                        this.logger.error("Failed to update grafana user", { orgId: orgId, userId: userId, role: role, error: this.formatError(e_14) });
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    return GrafanaSync;
}());
var grafanaSync = new GrafanaSync();
app.get("/healthz", function (req, res) {
    res.status(200).json({ status: "UP" });
});
app.get("/metrics", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
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
    console.info("Server listening on port " + port + "!");
    return grafanaSync.sync();
});
var interval = process.env.INTERVAL || commander.interval || 24 * 60 * 60 * 1000;
var updateInterval = setInterval(grafanaSync.sync, parseInt(interval, 10));
process.on("SIGTERM", function () {
    clearInterval(updateInterval);
    server.close(function (err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map