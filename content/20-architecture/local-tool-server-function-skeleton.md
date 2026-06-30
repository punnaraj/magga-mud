---
title: Local Tool Server Function Skeleton v0.2
tags: [architecture, local-tool-server, telegram, tools]
summary: Function skeleton for a local tool server with Telegram notification, logging, runtime context, and cleanup lifecycle.
status: draft
audience: developer
sensitivity: P1
reviewed: 2026-06-30
---

# Local Tool Server Function Skeleton v0.2

This note defines the first local tool server skeleton for the MUD workspace. It describes the required Telegram values, construction functions, core runtime functions, cleanup functions, minimal tool list, and minimal lifecycle.

## Required Telegram values

The operator must obtain these values from Telegram before enabling Telegram delivery:

| Value | Source | Required |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather | Yes |
| `TELEGRAM_CHAT_ID` | Target person, group, or channel chat ID | Yes |
| `TELEGRAM_THREAD_ID` | Group topic thread ID | Optional |

Secrets must stay outside public publication outputs and should be supplied through environment variables or a private runtime configuration file.

## Construction and initialization

### `create_runtime_context(params)`

Creates the central runtime context for the system.

**Input**

```yaml
params:
  node_id: string
  node_name: string
  environment: string
  base_path: string
  log_path: string
  config_path: string
```

**Return**

```yaml
runtime_context:
  runtime_id: string
  node_id: string
  node_name: string
  started_at: string
  base_path: string
  log_path: string
  config_path: string
  status: created
```

### `load_config(params)`

Loads server configuration.

**Input**

```yaml
params:
  config_path: string
```

**Return**

```yaml
config:
  loaded: boolean
  config_path: string
  values: object
  error: string | null
```

### `init_telegram_notifier(params)`

Creates the Telegram sender.

**Input**

```yaml
params:
  bot_token: string
  chat_id: string
  thread_id: string | null
  default_parse_mode: text | markdown | html
```

**Return**

```yaml
telegram_notifier:
  notifier_id: string
  chat_id: string
  thread_id: string | null
  ready: boolean
  error: string | null
```

### `init_log_writer(params)`

Creates the logger.

**Input**

```yaml
params:
  log_path: string
  format: jsonl | yaml | txt
```

**Return**

```yaml
log_writer:
  logger_id: string
  log_path: string
  format: string
  ready: boolean
  error: string | null
```

### `register_tools(params)`

Registers functions available from the server.

**Input**

```yaml
params:
  tools:
    - name: string
      description: string
      input_schema: object
      output_schema: object
```

**Return**

```yaml
tool_registry:
  registered_count: number
  tools:
    - name: string
      ready: boolean
```

## Core runtime functions

### `send_telegram_message(params)`

Sends a message to Telegram.

**Input**

```yaml
params:
  message: string
  bot_token: string
  chat_id: string
  thread_id: string | null
  parse_mode: text | markdown | html
  disable_notification: boolean
```

**Return**

```yaml
result:
  ok: boolean
  provider: telegram
  chat_id: string
  message_id: string | null
  sent_at: string
  error: string | null
```

### `send_status(params)`

Sends system status.

**Input**

```yaml
params:
  status: starting | running | warning | error | stopping | stopped
  message: string
  details: object | null
```

**Return**

```yaml
result:
  ok: boolean
  status: string
  delivered: boolean
  error: string | null
```

### `write_file(params)`

Creates or writes a file.

**Input**

```yaml
params:
  path: string
  content: string
  mode: create | overwrite | append
  encoding: utf-8
```

**Return**

```yaml
result:
  ok: boolean
  path: string
  bytes_written: number
  error: string | null
```

### `read_file(params)`

Reads a file.

**Input**

```yaml
params:
  path: string
  encoding: utf-8
```

**Return**

```yaml
result:
  ok: boolean
  path: string
  content: string | null
  bytes_read: number
  error: string | null
```

### `append_log(params)`

Appends a log entry.

**Input**

```yaml
params:
  event_type: string
  message: string
  data: object | null
```

**Return**

```yaml
result:
  ok: boolean
  log_id: string
  written_at: string
  error: string | null
```

### `create_policy(params)`

Creates a policy file.

**Input**

```yaml
params:
  policy_name: string
  policy_type: string
  content: string
  output_path: string
```

**Return**

```yaml
result:
  ok: boolean
  policy_name: string
  output_path: string
  error: string | null
```

### `run_task(params)`

Runs a defined task.

**Input**

```yaml
params:
  task_name: string
  args: object
```

**Return**

```yaml
result:
  ok: boolean
  task_name: string
  output: object | string | null
  error: string | null
```

### `get_system_status(params)`

Reads machine status.

**Input**

```yaml
params:
  include_disk: boolean
  include_memory: boolean
  include_network: boolean
  include_process: boolean
```

**Return**

```yaml
result:
  ok: boolean
  hostname: string
  uptime: string
  disk: object | null
  memory: object | null
  network: object | null
  process: object | null
  error: string | null
```

## Destruction and cleanup

### `flush_logs(params)`

Writes pending logs to file.

**Input**

```yaml
params:
  logger_id: string
```

**Return**

```yaml
result:
  ok: boolean
  flushed: boolean
  error: string | null
```

### `close_telegram_notifier(params)`

Closes the Telegram notifier.

**Input**

```yaml
params:
  notifier_id: string
```

**Return**

```yaml
result:
  ok: boolean
  closed: boolean
  error: string | null
```

### `release_runtime_context(params)`

Releases the runtime context.

**Input**

```yaml
params:
  runtime_id: string
```

**Return**

```yaml
result:
  ok: boolean
  runtime_id: string
  released_at: string
  error: string | null
```

### `cleanup_temp_files(params)`

Deletes temporary files.

**Input**

```yaml
params:
  temp_path: string
  older_than_seconds: number | null
```

**Return**

```yaml
result:
  ok: boolean
  deleted_count: number
  freed_bytes: number
  error: string | null
```

### `shutdown_tool_server(params)`

Shuts down the server.

**Input**

```yaml
params:
  reason: string
  notify_telegram: boolean
```

**Return**

```yaml
result:
  ok: boolean
  shutdown_started: boolean
  reason: string
  error: string | null
```

## Minimal tool list

The server should start with this minimal tool set:

```yaml
tools:
  - send_telegram_message
  - send_status
  - write_file
  - read_file
  - append_log
  - create_policy
  - run_task
  - get_system_status
  - flush_logs
  - cleanup_temp_files
  - shutdown_tool_server
```

## Minimal lifecycle

```text
create_runtime_context
load_config
init_log_writer
init_telegram_notifier
register_tools
send_status(starting)
server_running
send_status(stopping)
flush_logs
close_telegram_notifier
cleanup_temp_files
release_runtime_context
shutdown_tool_server
```

## Telegram message example

**Input**

```yaml
params:
  message: magga-001 started
  bot_token: ${TELEGRAM_BOT_TOKEN}
  chat_id: ${TELEGRAM_CHAT_ID}
  thread_id: null
  parse_mode: text
  disable_notification: false
```

**Return**

```yaml
result:
  ok: true
  provider: telegram
  chat_id: "123456789"
  message_id: "45"
  sent_at: "2026-07-01T00:00:00+07:00"
  error: null
```
