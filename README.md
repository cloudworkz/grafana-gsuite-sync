# grafana-gsuite-sync
[![license](https://img.shields.io/github/license/google-cloud-tools/grafana-gsuite-sync.svg?maxAge=604800)](https://github.com/google-cloud-tools/grafana-gsuite-sync)
[![Docker Repository on Quay](https://quay.io/repository/google-cloud-tools/grafana-gsuite-sync/status "Docker Repository on Quay")](https://quay.io/repository/google-cloud-tools/grafana-gsuite-sync)

### What It Does

Grafana GSuite Synchroniser pulls a Google Group, extracts Google Group Member Emails and updates the Grafana Organisation Users.

[![graph](https://raw.githubusercontent.com/google-cloud-tools/grafana-gsuite-sync/master/graph.png)](https://raw.githubusercontent.com/google-cloud-tools/grafana-gsuite-sync/master/graph.png)

### Requirements

- The service account's private key file: **--google-credentials** flag
- The email of the user with permissions to access the Admin APIs:  **--google-admin-email** flag
- The grafana admin password:  **--grafana-password** flag

### Usage

```
docker run -it quay.io/google-cloud-tools/grafana-gsuite-sync -h

Usage: grafana-gsuite-sync [options]

Options:

  -p, --port [port]                                        Server port
  -P, --grafana-protocol [grafana-protocol]                Grafana API protocol
  -H, --grafana-host [grafana-host]                        Grafana API host
  -U, --grafana-username [grafana-username]                Grafana API admin username (default: "")
  -P, --grafana-password <grafana-password>                Grafana API admin password (default: "")
  -C, --google-credentials <google-credentials>            Path to google admin directory credentials file (default: "")
  -D, --google-credentials-data <google-credentials-data>  The contents of the google directory credentials file (default: "")
  -A, --google-admin-email <google-admin-email>            The Google Admin Email for subject (default: "")
  -r, --rules <rules>                                      Comma separated rules to sync <google group email>:<grafana org name>:<users role> 
        (e.g. 'group@test.com:Main:Admin')
  -s, --static-rules <static-rules>                        Comma separated static rules to create <email>:<grafana org name>:<user role> 
        (e.g. 'user@test.com:Main:Viewer')
  -l, --level [level]                                      Log level
  -m, --mode [mode]                                        How users are sychronized between google and grafana: sync or upsert-only
  -e, --exclude-role [exclude-role]                        Exclude role to delete
  -i, --interval [interval]                                Sync interval
  -h, --help                                               output usage information
```