# Maestro security, incident response, and recovery

## Approval
New schools start PENDING and cannot log in. An operator must review independent evidence of school authority before approving. Configure PLATFORM_APPROVAL_KEY as a Worker secret, never in source control or client applications. The approval API is operator-only and must additionally be protected by network-level access control and rate limiting before production. Existing schools become PENDING after migration and require manual approval.

## Data protection
School records must not be exported without authorization. The privacy request API records access, correction and erasure requests; it does not automatically delete records. The published privacy notice must be replaced with an organization-specific, legally reviewed notice before launch. Define retention periods with schools and relevant authorities, legal holds, secure deletion, and breach notification responsibilities.

## Backup and restore runbook
1. Schedule encrypted D1 exports to access-controlled off-site storage using a separate approved operations process. Keep a dated manifest, integrity hashes, restricted keys, and retention policy.
2. In an incident, disable writes and revoke affected sessions. Record the incident timeline and preserve audit evidence.
3. Restore only into an isolated staging database using a verified backup; never overwrite production during testing.
4. Validate foreign keys, row counts, tenant isolation, school approvals, and attendance correction history.
5. Test application behavior and obtain two-person approval before a production restore.
6. Notify affected schools and regulators as required by applicable law.

This repository does not automate remote backups or restores. No production D1 operation is authorized by this document.
