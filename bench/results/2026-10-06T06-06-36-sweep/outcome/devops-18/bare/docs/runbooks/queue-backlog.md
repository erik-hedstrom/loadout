# Growing queue backlog

**Purpose:** Restore timely job processing while preserving queued work and protecting downstream services.

**Evidence and assumptions:** The supplied folder contained no application, configuration, or runbooks. This document assumes **Amazon SQS Standard + ECS workers with rolling deployments**. [Sample configuration](../examples/queue-config.example.json) is illustrative, not discovered infrastructure or an applied deployment. Replace all `<PLACEHOLDERS>` and confirm resource names, thresholds, worker shutdown behavior, and idempotency before production use. No established runbook style was available; this uses numbered incident steps.

## 1. Recognize the incident and open a timeline

1. Start when queue depth keeps rising, jobs arrive late, processing falls behind ingress, workers repeatedly fail, or the DLQ grows.
2. Suggested alerts, **not installed or validated SLOs**: oldest message age >300 seconds for 5 minutes; visible depth >1,000 and rising for 10 minutes; zero successful jobs for 5 minutes while work is queued; running workers below desired for 5 minutes; DLQ visible depth >0. Replace these with `<SERVICE_SLO_AND_ALERT_LINKS>`.
3. Post in `<INCIDENT_CHANNEL>`; record UTC start, customer impact, source/DLQ depth, oldest age, deployment revision, worker count, ingress/completion/error rates, and each mitigation. Assign `<INCIDENT_COMMANDER>` if impact is significant.
4. Do not purge the queue or delete messages to reduce an alert. A receive operation hides messages and counts as a delivery; use metrics and logs for initial triage.

## 2. Quick triage: first five minutes

1. Select the incident account and region. Use Bash, AWS CLI v2, and authorized incident credentials. Replace values below; sample names come from the example config.

   ```bash
   export AWS_PROFILE='<INCIDENT_AWS_PROFILE>'
   export AWS_REGION='eu-north-1'
   export AWS_PAGER=''
   QUEUE_NAME='orders-production'
   DLQ_NAME='orders-production-dlq'
   CLUSTER='production'
   SERVICE='orders-worker'
   aws sts get-caller-identity
   QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --query QueueUrl --output text)
   DLQ_URL=$(aws sqs get-queue-url --queue-name "$DLQ_NAME" --query QueueUrl --output text)
   ```

   Confirm identity and URLs against `<PRODUCTION_ACCOUNT_ID>` and the incident. Stop if a lookup fails or targets the wrong environment; do not continue with empty variables.

2. Check visible, in-flight, delayed, and DLQ counts, plus retention, visibility timeout, and redrive policy:

   ```bash
   aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names \
     ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
     ApproximateNumberOfMessagesDelayed VisibilityTimeout MessageRetentionPeriod RedrivePolicy
   aws sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names \
     ApproximateNumberOfMessages MessageRetentionPeriod
   ```

   Available + in-flight + delayed approximates total outstanding work. Counts are eventually consistent: compare several samples rather than treating one reading as exact. [AWS attribute reference](https://docs.aws.amazon.com/cli/latest/reference/sqs/get-queue-attributes.html).

3. Check oldest age and rates in **CloudWatch → Metrics → All metrics → SQS → Queue Metrics → source queue**, same region. Graph the last 30 minutes, with a 60-second period:

   | Signal | Metric / statistic | Interpretation |
   | --- | --- | --- |
   | Ready work | `ApproximateNumberOfMessagesVisible` / Maximum | Waiting for a consumer |
   | In-flight work | `ApproximateNumberOfMessagesNotVisible` / Maximum | Received but not yet deleted |
   | Delayed work | `ApproximateNumberOfMessagesDelayed` / Maximum | Not yet eligible for delivery |
   | Oldest age | `ApproximateAgeOfOldestMessage` / Maximum | Seconds; compare to service latency SLO |
   | Ingress | `NumberOfMessagesSent` / Sum divided by 60 | Messages/second |
   | Delivery | `NumberOfMessagesReceived` / Sum divided by 60 | Includes retries; not completions |
   | Delete throughput | `NumberOfMessagesDeleted` / Sum divided by 60 | Completion proxy only if workers delete after success; duplicates can inflate it |

   Select the DLQ separately and graph visible depth. SQS has no consumer-count or application-error metric. Standard-queue poison messages can be excluded from oldest-age reporting; DLQ age alone does not show original end-to-end delay. Missing data is not zero. [AWS metric semantics](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-available-cloudwatch-metrics.html).

   For a CLI age check, set UTC times covering the incident:

   ```bash
   START_UTC='<YYYY-MM-DDTHH:MM:SSZ>'
   END_UTC='<YYYY-MM-DDTHH:MM:SSZ>'
   aws cloudwatch get-metric-statistics --namespace AWS/SQS \
     --metric-name ApproximateAgeOfOldestMessage \
     --dimensions "Name=QueueName,Value=$QUEUE_NAME" \
     --start-time "$START_UTC" --end-time "$END_UTC" --period 60 \
     --statistics Maximum --query 'sort_by(Datapoints,&Timestamp)'
   ```

   [CLI metric reference](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/get-metric-statistics.html).

4. Check consumer capacity and deploy state:

   ```bash
   aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
     --query '{failures:failures,services:services[].{desired:desiredCount,running:runningCount,pending:pendingCount,taskDefinition:taskDefinition,deployments:deployments,events:events[:10]}}'
   ```

   Running ECS tasks are a capacity proxy, not proof of active polling or a count of worker processes. In **ECS → Clusters → cluster → Services → service → Tasks**, check stopped-task reasons, exit codes, OOMs, health checks, and placement failures. Compare task count with `<WORKER_HEARTBEAT_OR_ACTIVE_POLLER_METRIC>` and successful job throughput. [ECS service reference](https://docs.aws.amazon.com/cli/latest/reference/ecs/describe-services.html).

5. Open **CloudWatch → Logs → Log groups → `/ecs/orders-worker`** (sample path) and `<WORKER_SUCCESS_ERROR_LATENCY_DASHBOARD_URL>`. Compare current vs pre-incident successes/minute, failed attempts/minute, failure fraction (`failed attempts / all completed attempts`), job duration p95/p99, dependency latency, timeouts, and 429s. Search logs for repeated message/job IDs, retry counts, stack traces, and jobs started without completion. If app metrics are absent, estimate from structured success/error logs over the same interval and label the estimate. Keep payloads and secrets out of incident chat.

## 3. Identify the cause and apply one mitigation at a time

| Cause | Distinguishing evidence | First action |
| --- | --- | --- |
| Consumers down or crashing | Running < desired; stopped tasks, OOMs, startup/IAM errors; near-zero completions | Restore healthy workers; restart only after identifying the failure (step 4.2) |
| Slow downstream dependency | Workers running; job latency/in-flight count rises; dependency timeouts, saturation or 5xx | Page dependency owner; reduce concurrent requests or pause nonessential production; scaling can worsen overload |
| Poison messages | Same IDs/payload type repeatedly fail; receive counts rise; DLQ grows; other jobs succeed | Let configured redrive isolate failed messages; investigate schema/data failure (step 4.4) |
| Traffic spike | Ingress increases first; per-job latency/errors remain near baseline; workers saturated | Scale within approved capacity; shed/pause nonessential producers if needed (steps 4.1, 4.3) |
| Bad deploy | Error/latency increase aligns with worker or producer release; previous revision was healthy | Roll back offending deployment after checking message compatibility (step 4.5) |
| Stuck or rate-limited job | Start without finish; repeated long visibility extensions, lock waits, or 429/Retry-After; no useful progress | Inspect job owner/lock/dependency; stop retry storms, honor backoff, reduce concurrency; restart only if safe |

## 4. Mitigation procedures

1. **Scale consumers.** Confirm downstream headroom, quotas, and `<APPROVED_WORKER_CEILING>` with `<SERVICE_OWNER>`. Record the original desired count and autoscaling settings. Increase in a small step, then observe throughput/errors for 5 minutes:

   ```bash
   TARGET_WORKERS='<APPROVED_INTEGER>'
   aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --desired-count "$TARGET_WORKERS"
   ```

   Coordinate with `<AUTOSCALING_POLICY_OWNER>` if autoscaling overwrites the change. If throughput does not improve or dependency errors increase, return to the recorded count and reassess.

2. **Restart workers.** Correct configuration, credentials, memory, or dependency access first. Confirm jobs tolerate duplicate delivery and workers shut down gracefully without deleting unfinished messages. A rolling restart may temporarily reduce capacity and retry in-flight jobs after visibility expires:

   ```bash
   aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment
   ```

   Inspect deployment progress and task failures; stop repeated restarts if new tasks fail identically. An ECS restart with a mutable image tag can pull changed code: confirm the task definition/image is the intended version. These update commands assume the ECS rolling deployment controller. [AWS update-service reference](https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html).

3. **Pause or throttle producers.** Use `<PRODUCER_FEATURE_FLAG_OR_DEPLOYMENT_RUNBOOK>` with `<PRODUCER_OWNER>`. No pause control was supplied. Confirm incoming requests will be buffered durably, rejected explicitly, or retried safely; do not silently accept and lose work. Record affected features and pause time, and verify SQS ingress actually falls. Keep healthy consumers running. Resume gradually after downstream recovery and backlog reduction.

4. **Move poison messages to the DLQ.** Inspect `RedrivePolicy`: confirm the intended DLQ ARN and `maxReceiveCount` (sample: 5). Workers must leave failed messages undeleted; SQS moves them automatically after the retry threshold. Watch repeated failures stop in the source and DLQ visible depth increase. [AWS DLQ behavior](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html).

   If no policy exists, escalate to `<QUEUE_PLATFORM_OWNER>` for an approved infrastructure change through `<QUEUE_INFRA_CHANGE_RUNBOOK>`; do not invent a bulk move command or lower retry limits blindly. Manual quarantine requires `<APPROVED_QUARANTINE_TOOL>` that preserves body/attributes and confirms DLQ send before source deletion, with duplicate-safe handling; SQS send and delete are not atomic. No such tool is included here. Preserve evidence and retention headroom; do not replay until the underlying fault is fixed and `<SERVICE_OWNER>` approves a controlled canary replay. `start-message-move-task` is a DLQ redrive operation, not a source-queue poison-message selector.

5. **Roll back a bad deploy.** Freeze further releases. Identify the last healthy **full task-definition ARN** in `<DEPLOYMENT_HISTORY_URL>`; check that old code supports messages already emitted by the new producer, and that rollback does not undo required data/schema changes. Use `<STANDARD_ROLLBACK_PIPELINE>` when available. For the assumed ECS rolling service:

   ```bash
   LAST_GOOD_TASK_DEFINITION='<FULL_LAST_GOOD_TASK_DEFINITION_ARN>'
   aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
     --task-definition "$LAST_GOOD_TASK_DEFINITION"
   ```

   Monitor rollout, task failures, and processing metrics. Roll back a producer through its own deployment pipeline if it emits incompatible jobs; isolate affected messages rather than repeating failures.

6. **Unstick or rate-limit jobs.** Determine whether the job is progressing before interruption; compare runtime to expected duration and visibility timeout (sample: 120 seconds). If processing exceeds visibility, duplicate deliveries can occur: have `<WORKER_OWNER>` verify bounded heartbeat/visibility extensions and idempotency. Apply dependency-aware backoff and concurrency caps via `<WORKER_RUNTIME_CONFIG_RUNBOOK>`. Release locks/cancel jobs only via `<APPROVED_JOB_RECOVERY_PROCEDURE>` after checking side effects. Escalate if no safe recovery tool exists; do not edit locks or shorten visibility blindly.

## 5. Escalate

1. **Immediately** page `<PRIMARY_SERVICE_ON_CALL>` via `<PAGING_SERVICE>` for customer-visible SLA failure, zero healthy consumers, suspected loss/duplicate side effects, or age approaching source retention. Notify `<INCIDENT_COMMANDER>` in `<INCIDENT_CHANNEL>` and follow `<SEVERITY_POLICY>`.
2. After **10 minutes without an identified cause**, or **15 minutes without improving depth/age**, page `<SECONDARY_SERVICE_ON_CALL>` and `<QUEUE_PLATFORM_ON_CALL>` in `<PLATFORM_CHANNEL>`. These are proposed time limits; replace with local policy.
3. For dependency failures/429s contact `<DEPENDENCY_ON_CALL>` via `<DEPENDENCY_CHANNEL>`; for a bad deploy contact `<RELEASE_OWNER>`; for sustained excess ingress contact `<PRODUCER_OWNER>` and `<CAPACITY_OWNER>`.
4. Send account/region, queue name, impact, graphs, worker/deploy state, sanitized job IDs, actions/results, and estimated time to retention expiry. Call out missing permissions, metrics, or recovery tooling.

## 6. Verify recovery and close

1. Every 2 minutes, recheck source visible/in-flight/delayed counts, oldest age, DLQ depth, active workers, success/error rates, and downstream health. Verify successful processing exceeds ingress over several intervals; retries/deletes alone are insufficient evidence.
2. Estimate drain time as `outstanding work / (successful jobs per second − incoming jobs per second)` only when rates use comparable units, are stable, and completion exceeds ingress. Otherwise report no reliable drain estimate. Escalate if predicted recovery exceeds the SLA or retention headroom.
3. Require **15 minutes** of falling total outstanding work and healthy error/latency rates, then return depth and age below `<RECOVERY_THRESHOLDS>`. An age drop can mean DLQ movement or expiry: confirm business completions, investigate missing work, and assign an owner to every DLQ batch. Account for intentionally delayed jobs.
4. Resume paused producers gradually; restore temporary capacity/concurrency settings through their owners and monitor for another 15 minutes. Record remaining DLQ work and its recovery deadline before resolving the incident.
5. Follow up in `<POST_INCIDENT_TRACKER>`: timeline/root cause; safe DLQ replay and reconciliation; retry/backoff and timeout fixes; idempotency; downstream limits; autoscaling capacity; tests for the failing job; missing heartbeat/error/latency metrics; alert tuning. Replace this runbook's sample configuration, contacts, and control placeholders with verified production values.
