# Security

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not include private browsing data in a public issue.

## Design boundaries

Groupback has no backend, host permissions, content scripts, remote code, or telemetry. User-controlled titles and URLs are rendered with DOM `textContent`, and only HTTP(S) URLs can be stored or reopened.
