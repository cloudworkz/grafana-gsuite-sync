# grafana-gsuite-sync
[![license](https://img.shields.io/github/license/google-cloud-tools/grafana-gsuite-sync.svg?maxAge=604800)](https://github.com/google-cloud-tools/grafana-gsuite-sync)
[![Docker Repository on Quay](https://quay.io/repository/google-cloud-tools/grafana-gsuite-sync/status "Docker Repository on Quay")](https://quay.io/repository/google-cloud-tools/grafana-gsuite-sync)
[![Docker Pulls](https://img.shields.io/docker/pulls/google-cloud-tools/grafana-gsuite-sync.svg?maxAge=604800)](https://hub.docker.com/r/google-cloud-tools/grafana-gsuite-sync)
[![Go Report Card](https://goreportcard.com/badge/github.com/google-cloud-tools/grafana-gsuite-sync)](https://goreportcard.com/report/github.com/google-cloud-tools/grafana-gsuite-sync)

### What It Does

Grafana GSuite Synchroniser pulls a Google Group, extracts Google Group Member Emails and updates the Grafana Organisation Users.

### Requirements

- The service account's private key file: **-config-file-path** flag
- The email of the user with permissions to access the Admin APIs:  **-google-admin-email** flag