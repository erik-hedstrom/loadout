## Runbook: Growing queue backlog

**Owner:** [QUEUE_SERVICE_TEAM / PRIMARY_ON_CALL] | **Frequency:** As needed  
**Last Updated:** 2026-10-07 | **Last Run:** Not run against a live service

### Purpose

Restore timely job processing while preserving messages and limiting customer impact.

**Assumption:** This test folder was empty: no queue configuration, application code, deployment tooling, or existing runbook style was available. This procedure assumes **Amazon SQS standard queues with Kubernetes workers**. It follows the supplied runbook template. [Sample configuration](../examples/queue-backlog.sample.json) and [sample incident metrics](../examples/queue-backlog.snapshot.json) are invented fixtures, not deployed infrastructure. Replace every `[PLACEHOLDER]` and verify the platform before use. FIFO queues require a separate check of blocked message groups and ordering requirements.

### Symptoms and triggers

1. Jobs are late, processing latency exceeds [JOB_LATENCY_SLO], or customers report missing asynchronous work.
2. Oldest-message age rises across consecutive samples; visible backlog grows while completion rate falls behind arrivals.
3. Workers are unavailable, repeatedly restarting, or reporting elevated errors; messages accumulate in the DLQ.
4. Suggested initial alerts, **not configured here**: oldest age >300 seconds for 10 minutes; visible depth >1,000 and rising for 10 minutes; zero healthy consumers for 5 minutes with pending work; any DLQ messages. Replace these with service-approved thresholds and [ALERT_LINKS].

### Prerequisites

- [ ] AWS CLI v2, `kubectl`, Bash, GNU `date`, and read access to SQS, CloudWatch, Kubernetes events and restricted application logs.
- [ ] Confirm [AWS_ACCOUNT_ID], region, queue, DLQ, Kubernetes context, namespace, service owner, and incident channel.
- [ ] For changes: incident authorization and appropriate deployment/SQS permissions. Identify [DEPLOYMENT_PIPELINE], autoscaler/GitOps ownership, and [PRODUCER_PAUSE_CONTROL].
- [ ] Know worker shutdown behavior, job idempotency, downstream capacity, concurrency limits, retry policy, and safe maximum replicas [MAX_SAFE_REPLICAS].

### Procedure

#### Step 1: Declare the incident and confirm the target

1. Open [INCIDENT_CHANNEL] and record impact, alert time, queue, current release, and recent changes. Assign [INCIDENT_COMMANDER] if customers are affected.
2. Set real targets in the same Bash session. No credentials belong in this file.

```bash
export AWS_PROFILE='[ON_CALL_PROFILE]'
export AWS_REGION='[AWS_REGION]'
export AWS_PAGER=''
export QUEUE_NAME='[QUEUE_NAME]'
export QUEUE_URL='[QUEUE_URL]'
export DLQ_URL='[DLQ_URL]'
export KUBE_CONTEXT='[KUBE_CONTEXT]'
export NAMESPACE='[NAMESPACE]'
export WORKER_DEPLOYMENT='[WORKER_DEPLOYMENT]'
export WORKER_SELECTOR='[WORKER_LABEL_SELECTOR]'
aws sts get-caller-identity
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" get deployment "$WORKER_DEPLOYMENT"
```

**Expected result:** Account and deployment match the affected environment.  
**If it fails:** Stop changes; ask [PLATFORM_ON_CALL] to resolve access or identify the correct target. Never guess a production queue URL.

#### Step 2: Capture queue depth, age, and throughput

1. Inspect queue counts, retention, visibility, and the configured DLQ:

```bash
aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names \
  QueueArn ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  ApproximateNumberOfMessagesDelayed VisibilityTimeout MessageRetentionPeriod RedrivePolicy
aws sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names \
  QueueArn ApproximateNumberOfMessages MessageRetentionPeriod
```

2. Retrieve the last 15 minutes of CloudWatch data:

```bash
START_TIME=$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
for METRIC in ApproximateAgeOfOldestMessage ApproximateNumberOfMessagesVisible ApproximateNumberOfMessagesNotVisible ApproximateNumberOfMessagesDelayed; do
  aws cloudwatch get-metric-statistics --namespace AWS/SQS \
    --metric-name "$METRIC" --dimensions "Name=QueueName,Value=$QUEUE_NAME" \
    --start-time "$START_TIME" --end-time "$END_TIME" --period 60 \
    --statistics Maximum --query 'sort_by(Datapoints, &Timestamp)' --output table
done
for METRIC in NumberOfMessagesSent NumberOfMessagesReceived NumberOfMessagesDeleted; do
  aws cloudwatch get-metric-statistics --namespace AWS/SQS \
    --metric-name "$METRIC" --dimensions "Name=QueueName,Value=$QUEUE_NAME" \
    --start-time "$START_TIME" --end-time "$END_TIME" --period 60 \
    --statistics Sum --query 'sort_by(Datapoints, &Timestamp)' --output table
done
```

3. Console alternative: **AWS Console → CloudWatch → Metrics → All metrics → SQS → Queue Metrics → the queue name**, in the confirmed region. Use 1-minute periods: Maximum for age/depth, Sum for sent/received/deleted. Inspect DLQ depth separately. Application dashboard: [WORKER_DASHBOARD_URL]; no repo-specific dashboard was found.
4. Record ready consumers, successful jobs/second, failed attempts/second, retry count, and p95 processing duration from [APPLICATION_METRICS_OR_LOG_QUERY]. Error fraction = failed attempts / total attempts over the same interval. SQS has no application processing-error metric; unavailable instrumentation is unknown, not zero errors.

**Interpretation:** Visible = waiting; not-visible = in flight; delayed = unavailable until delay expires. Sum/60 estimates messages/second for a complete minute. Deletes are a completion proxy, not unique successful jobs; receives include retries. Ready pods are a capacity proxy, not proof that polling works. Age can exclude repeatedly failing messages on standard queues; inspect retries and DLQ even when age drops. Counts are approximate, so compare several intervals. These limitations are described in [AWS SQS metrics](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-available-cloudwatch-metrics.html).

**Expected result:** Enough data to distinguish arrival growth from lost capacity.  
**If it fails:** Check region, QueueName dimension, permissions and metric freshness. Missing datapoints do not establish an empty queue. Use SQS console **Queues → queue → Monitoring**, and escalate observability gaps. CLI details: [queue attributes](https://docs.aws.amazon.com/cli/latest/reference/sqs/get-queue-attributes.html), [metric statistics](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/get-metric-statistics.html).

#### Step 3: Check consumers and recent deployments

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" get deployment "$WORKER_DEPLOYMENT" -o wide
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" get pods -l "$WORKER_SELECTOR" -o wide
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" describe deployment "$WORKER_DEPLOYMENT"
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" get events --sort-by=.metadata.creationTimestamp
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" logs -l "$WORKER_SELECTOR" \
  --all-containers=true --prefix=true --since=15m --tail=200 --max-log-requests=10
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout history deployment/"$WORKER_DEPLOYMENT"
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" get hpa
```

1. Compare desired/ready replicas; look for CrashLoopBackOff, OOMKilled, Pending pods, image/auth failures, and failed polling.
2. Inspect a failing pod and its previous worker container logs:

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" describe pod '[FAILING_POD]'
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" logs '[FAILING_POD]' \
  -c '[WORKER_CONTAINER]' --previous --since=15m --tail=200
```

3. Correlate deploy time with backlog/error onset. Check [RELEASE_HISTORY_URL], dependency latency/5xx/429s, connection pool saturation, and job IDs/receive counts in restricted logs. Check KEDA or other autoscalers through [AUTOSCALER_DASHBOARD]; `get hpa` alone does not rule them out.

**Expected result:** A cause supported by timestamps, metrics, or error signatures.  
**If it fails:** Missing previous logs can mean no retained prior container. Use [CENTRAL_LOGS_URL]. An excessive pod count may exceed the log concurrency limit; query individual pods. Keep payloads/secrets out of incident chat. See [kubectl logs](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/).

#### Step 4: Choose the cause and mitigation

Apply one change at a time, record its time, and reassess after 5 minutes. Escalate immediately if data loss, customer impact, or retention expiry is near.

| Cause | Evidence that distinguishes it | Mitigation |
|---|---|---|
| Consumers down/crashing | Ready replicas below desired; restarts, OOM, Pending, auth/poll errors; receives and deletes drop | Fix missing capacity/config/access through [DEPLOYMENT_PIPELINE]; use Step 5 to restore replicas. Restart only after addressing a transient fault; roll back a newly introduced crash. |
| Slow downstream dependency | Consumers ready; job duration/timeouts rise with dependency latency, 5xx, DB/pool saturation | Page [DEPENDENCY_ON_CALL]. Reduce concurrency with [WORKER_CONCURRENCY_CONTROL]; pause optional producers with Step 6. Scale only if the dependency has headroom. |
| Poison messages | Same job IDs fail deterministically; receive counts/retries rise; DLQ grows while other jobs succeed | Use Step 7 to quarantine through the configured redrive policy. Fix the payload/handler before replay. |
| Traffic spike | Sent rate rises; worker duration and error fraction stay near baseline; completion capacity is saturated | Scale gradually with Step 5 within downstream limits; throttle optional arrivals with Step 6 if needed. |
| Bad deploy | Onset aligns with release; new exception/schema/permission failures or slower processing | Roll back using Step 8 after checking compatibility; stop new incompatible messages if necessary. |
| Stuck or rate-limited job | Long-running job IDs, in-flight growth, little progress; visibility expiry causes duplicates; 429/Retry-After or exhausted quota | Honor dependency backoff/quota using [JOB_RETRY_OR_RATE_LIMIT_CONTROL]. Restore visibility heartbeats or timeout policy via service owner; restart only a confirmed stuck worker after capturing evidence. Scaling can worsen throttling. |

#### Step 5: Scale or restart workers

1. Record the current replica count before changing it:

```bash
ORIGINAL_REPLICAS=$(kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" \
  get deployment "$WORKER_DEPLOYMENT" -o jsonpath='{.spec.replicas}')
printf 'Original replicas: %s\n' "$ORIGINAL_REPLICAS"
```

2. Choose [TARGET_REPLICAS] below [MAX_SAFE_REPLICAS], constrained by downstream throughput, cluster capacity and per-worker concurrency. If an autoscaler or GitOps controller owns replicas, use [APPROVED_SCALING_CONTROL] and record its original setting. For a manually managed Deployment:

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" scale deployment/"$WORKER_DEPLOYMENT" --replicas='[TARGET_REPLICAS]'
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout status deployment/"$WORKER_DEPLOYMENT" --timeout=180s
```

3. For a confirmed stuck process or resolved transient fault, check graceful termination and idempotency before a rolling restart:

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout restart deployment/"$WORKER_DEPLOYMENT"
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout status deployment/"$WORKER_DEPLOYMENT" --timeout=180s
```

**Expected result:** Healthy workers increase successful completion rate.  
**If it fails:** Inspect scheduling/events and controller overrides; restore the prior capacity if dependency errors increase. Restarted work can reappear after visibility expiry; check duplicate side effects. Do not repeat restarts blindly. Command reference: [kubectl](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands).

#### Step 6: Pause or throttle producers

1. Identify every producer via [PRODUCER_INVENTORY]; decide which arrivals may be deferred with [SERVICE_OWNER / INCIDENT_COMMANDER]. Confirm where deferred work is durably retained and how users are notified.
2. Use **[PRODUCER_PAUSE_CONTROL: exact feature flag, dashboard path or command]**, record its old value, and stop optional jobs first. No pause implementation exists in this sample; the service owner must supply it.
3. Verify sent rate falls and deferred work is retained. SQS has no queue-wide producer pause switch; stopping consumers does not stop arrivals.

**Expected result:** Arrivals fall below safe processing capacity without losing accepted work.  
**If it fails:** Find other producers or ask [PRODUCER_ON_CALL] to throttle ingress through an approved control. Do not purge the queue or remove access policies as a shortcut.

#### Step 7: Quarantine poison messages in the DLQ

1. Confirm `RedrivePolicy` from Step 2 references the intended DLQ and inspect its `maxReceiveCount`. The sample assumes five receives, but does not configure that policy anywhere.
2. Let ordinary worker retries reach the configured redrive threshold: SQS moves repeatedly failing messages to the DLQ. Watch DLQ depth and preserve job IDs, exception signatures and restricted diagnostic evidence. Do not receive live messages just to inspect them; receiving changes visibility and receive counts.
3. If no DLQ is configured, ask [QUEUE_SERVICE_OWNER] for an approved redrive-policy change through [INFRA_CHANGE_PIPELINE]. If a message blocks urgent work before normal quarantine, use [APPROVED_SINGLE_MESSAGE_QUARANTINE_TOOL]. No such tool exists here: escalate rather than inventing a receive/copy/delete procedure that could lose data.
4. Check DLQ retention provides enough investigation time; for standard queues, configure it longer than source retention. Never bulk replay while the failing handler/payload remains unfixed. See [SQS DLQ behavior](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html).

**Expected result:** Repeated failures leave the source queue and remain recoverable in the DLQ.  
**If it fails:** Escalate missing/mismatched policy, permissions, retention risk, or excessive healthy-message failures. Do not lower the receive threshold or delete messages without owner review.

#### Step 8: Roll back a bad deployment

1. Identify [KNOWN_GOOD_REVISION] in Step 3's rollout history and [RELEASE_HISTORY_URL]. Confirm old code can process current message formats and is compatible with database/config changes.
2. Prefer [DEPLOYMENT_PIPELINE_ROLLBACK_CONTROL] for GitOps-managed workloads. For an approved manually managed Deployment:

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout undo deployment/"$WORKER_DEPLOYMENT" --to-revision='[KNOWN_GOOD_REVISION]'
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout status deployment/"$WORKER_DEPLOYMENT" --timeout=180s
```

**Expected result:** Known-good workers become ready and errors/duration return toward baseline.  
**If it fails:** Escalate unavailable history or incompatibility to [RELEASE_OWNER]; pause affected producers if approved. Do not roll back schema/data changes blindly. Record actual running image after rollback.

### Verification

1. Repeat Steps 2–3 every 5 minutes for at least 15 minutes; regenerate the time window each time. Record visible, in-flight, delayed, age, arrivals, successful completions, errors and DLQ depth.
2. Confirm pending work trends downward and successful completion rate exceeds arrivals until the backlog recovers. Check age against [JOB_LATENCY_SLO], not just queue depth. Approximate drain time = pending jobs / (successful jobs/sec − arrivals/sec), only if rates are stable and the denominator is positive.
3. Confirm jobs complete end to end, including [CUSTOMER_WORKFLOW_CHECK], with healthy consumers, normal duration/error fraction, stable dependencies, and no unexplained DLQ growth. A falling age alone is insufficient: messages may have moved to DLQ or expired.
4. Resume producers gradually, confirm recovery holds under normal arrivals, and return temporary scaling/concurrency controls to documented values. Keep quarantined work tracked separately until safely resolved.

**If verification fails:** Reclassify using Step 4 and escalate; do not close the incident because an alert briefly cleared.

### Rollback of incident mitigations

1. If extra consumers overload a dependency, restore the recorded autoscaler setting or manual replicas:

```bash
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" scale deployment/"$WORKER_DEPLOYMENT" --replicas="$ORIGINAL_REPLICAS"
kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" rollout status deployment/"$WORKER_DEPLOYMENT" --timeout=180s
```

2. Restore producer pause/rate/concurrency controls using their recorded old values only after safe capacity is available. Coordinate configuration and release changes with their owners; Kubernetes deployment history does not restore external settings.
3. A restart cannot undo completed side effects. Ask [SERVICE_OWNER] to reconcile duplicates or incomplete jobs using [RECONCILIATION_PROCEDURE].
4. DLQ replay is a separate approved recovery operation after a fix and idempotency check. Start with [CANARY_REPLAY_COUNT] via [APPROVED_REPLAY_TOOL] and monitor before expanding. SQS `start-message-move-task` starts from a DLQ and is not a selective source-queue quarantine tool; see [redrive CLI constraints](https://docs.aws.amazon.com/cli/latest/reference/sqs/start-message-move-task.html).

### Escalation

| When | Contact | Method |
|---|---|---|
| Immediately: customer impact, suspected loss/duplicates, or age nearing retention expiry | [INCIDENT_COMMANDER], [QUEUE_SERVICE_OWNER] | [PAGING_SERVICE] and [INCIDENT_CHANNEL] |
| No drain within 15 minutes of mitigation; no healthy consumers for 5 minutes | [QUEUE_SERVICE_SECONDARY_ON_CALL] | [TEAM_PAGER] |
| Scheduling, IAM, polling/network failure, or failed rollout | [PLATFORM_ON_CALL] | [PLATFORM_PAGER / CHANNEL] |
| Dependency latency/5xx/429s or quota exhaustion | [DEPENDENCY_ON_CALL] | [DEPENDENCY_PAGER / CHANNEL] |
| Deploy correlation, incompatible job schema, or unsafe rollback | [RELEASE_OWNER], [SERVICE_TECH_LEAD] | [RELEASE_CHANNEL] |
| AWS service incident suspected after local checks | [CLOUD_ON_CALL] | [CLOUD_CHANNEL / AWS_SUPPORT_CASE_PATH] |

Include incident link, account/region/queue, impact, oldest age versus retention, depth trend, ready consumers, rates, errors, release ID, actions/results, and help needed. Use the actual severity/SLO policy if it requires earlier escalation.

### Follow-up

1. Record the timeline, root cause, mitigations, configuration changes and final metrics in [INCIDENT_RECORD]. Update History below.
2. Reconcile accepted, completed, duplicated, expired and quarantined jobs. Assign an owner for DLQ repairs and controlled replay; keep an explicit count of unresolved work.
3. Remove temporary overrides, confirm producer resumption, and check normal alerting and autoscaling ownership.
4. File concrete prevention work: capacity/headroom, downstream limits, timeouts/heartbeats, retry backoff, poison-message handling, idempotency, and release tests as applicable.
5. Replace assumptions and placeholders with actual config, dashboard links, alert thresholds, contacts and controls. Exercise this procedure in staging before adopting it for production.

### Offline walkthrough and validation limits

The sample snapshots show 900 arrivals and 600 completions per 300 seconds: 3 arrivals/sec versus 2 completions/sec. Visible depth grows from 1,200 to 1,500 and age from 310 to 390 seconds, with three ready workers and a stable ~0.5% failed-attempt fraction. Step 4 therefore suggests a traffic spike/capacity limit; verify downstream headroom before scaling. This is a fixture exercise, not evidence about a real incident.

No AWS/Kubernetes tools, live service, credentials, dashboards, or deployment history were available for operational testing. Bash syntax, relative links, JSON fixtures, required sections and the sample rate calculations were checked locally; production behavior remains untested.

### History

| Date | Run By | Notes |
|---|---|---|
| 2026-10-07 | Codex (offline documentation exercise) | Created from an empty folder using explicit SQS/Kubernetes assumptions; no live operations performed. |
