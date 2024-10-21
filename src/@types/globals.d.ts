declare interface Run {
  runId: 0;
  state: TaskState; // "completed";
  reasonCreated: string; // "scheduled";
  reasonResolved: string; // "completed";
  workerGroup: string; // "built-in";
  workerId: string; // "succeed";
  takenUntil: string; // "2023-09-19T20:33:46.188Z";
  scheduled: string; // "2023-09-19T20:13:45.402Z";
  started?: string; // "2023-09-19T20:13:46.193Z";
  resolved?: string; // "2023-09-19T20:13:46.266Z";
}

declare interface ListArtifacts {
  artifacts: Array<{
    storageType: string, // "s3", "reference"
    name: string, // "public/logs/live_backing.log"
    expires: string // "2025-06-11T22:22:03.979Z",
    contentType: string // "text/plain; charset=utf-8"
  }>
}

declare interface Task {
  provisionerId: string; // "built-in";
  workerType: string; // "succeed";
  taskQueueId: string; // "built-in/succeed";
  schedulerId: string; // "translations-level-1";
  projectId: string; // "none";
  taskGroupId: string; // "Fo1npr9eTFqsAj4DFlqBbA";
  dependencies: string[], // ["CTPPid-iT8WUEzf-j6YKUw", "Fn-77WB6SFKBuQGE62-SMg", ... ]
  requires: string; // "all-completed";
  routes: ["checks"];
  priority: string; // "low";
  retries: 5;
  created: string; // "2023-09-19T18:58:07.341Z";
  deadline: string; // "2023-09-24T18:58:07.341Z";
  expires: string; // "2023-10-17T18:58:07.341Z";
  scopes: string[]; // ["generic-worker:cache:translations-level-3-checkouts"]
  payload: {
    // This was all the same for translations.
    artifacts: [
      {
        name: "public/build",
        path: "artifacts",
        type: "directory"
      }
    ],
    // The command comes in the form of an array, e.g. ["echo", "hello"]
    command: Array<string[]>
  };
  metadata: {
    name: string; // "all-ru-en";
    owner: string; // "eu9ene@users.noreply.github.com";
    source: string; // "https://github.com/mozilla/firefox-translations-training/blob/773420ae1011f78ef58d375a75c61b65d324aa70/taskcluster/ci/all";
    description: string; // "Dummy task that ensures all parts of training pipeline will run";
  };
  tags: {
    kind: string; // "all";
    label?: string; // "all-ru-en";
    createdForUser: string; // "eu9ene@users.noreply.github.com";
    "worker-implementation": string; // "succeed";
  };
  extra: {
    index: { rank: 0 };
    parent: string; // The task's group id "Fo1npr9eTFqsAj4DFlqBbA";
  };
}

declare interface TaskDependents {
  taskId: string,
  tasks: TaskAndStatus[]
}

declare interface TaskStatus {
  taskId: string; // "ewZ4vpZbQISjhIPnU3R36g";
  provisionerId: string; // "built-in";
  workerType: string; // "succeed";
  taskQueueId: string; // "built-in/succeed";
  schedulerId: string; // "translations-level-1";
  projectId: string; // "none";
  taskGroupId: string; // "Fo1npr9eTFqsAj4DFlqBbA";
  deadline: string; // "2023-09-24T18:58:07.341Z";
  expires: string; // "2023-10-17T18:58:07.341Z";
  retriesLeft: number;
  state: TaskState; // "completed";
  runs?: Run[];
}

declare interface TaskAndStatus {
  status: TaskStatus;
  task: Task;
}

declare interface TaskGroup {
  taskGroupId: string, // "Fo1npr9eTFqsAj4DFlqBbA",
  schedulerId: string, // "translations-level-1",
  expires: string,// "2024-09-18T19:57:56.114Z",
  tasks: TaskAndStatus[],
  continuationToken?: string
}

declare type TaskID = string;

/**
 * This is the definition of the task-graph.json generated by taskgraph.
 */
declare type TaskGraph = Record<TaskID, TaskDefinition>;

declare interface TaskDefinition {
  // The attributes that are passed into tasks. This includes general task information
  // like "cache" and "cached_task", plus custom attributes like "src_locale" and
  // "trg_locale".
  attributes: Record<string, any>;
  // The key is the task label like "toolchain-marian".
  dependencies: Record<string, TaskID>;
  // The description of the task.
  description: string;
  // New kinds could be introduced as the pipeline evolves.
  // For instance, finetune-student is: taskcluster/kinds/finetune-student/kind.yml
  kind:
    "alignments"
    | "all"
    | "bicleaner"
    | "cefilter"
    | "clean-corpus"
    | "clean-mono"
    | "collect-corpus"
    | "collect-mono-src"
    | "collect-mono-trg"
    | "dataset"
    | "docker-image"
    | "evaluate"
    | "evaluate-quantized"
    | "evaluate-teacher-ensemble"
    | "export"
    | "extract-best"
    | "fetch"
    | "finetune-student"
    | "merge-corpus"
    | "merge-devset"
    | "merge-mono"
    | "merge-translated"
    | "quantize"
    | "score"
    | "split-corpus"
    | "split-mono-src"
    | "split-mono-trg"
    | "toolchain"
    | "train-backwards"
    | "train-student"
    | "train-teacher"
    | "train-vocab"
    | "translate-corpus"
    | "translate-mono-src"
    | "translate-mono-trg"

  task: Task;

  // The full label like: "clean-mono-news-crawl-ru-news_2010-mono-trg"
  label: string;
  // This doesn't seem relevant to translations.
  optimization: Record<string, any>;
  // These were always blank for translations.
  if_dependencies: [];
  // These were always blank for translations.
  soft_dependencies: [];
  task_id: string;
}

interface TimeRange {
  start: number | null;
  end: number | null;
}

interface TimeRangeNonNull {
  start: number;
  end: number;
}

interface TimeRangeCost {
  start: number | null;
  end: number | null;
  state: TaskState;
  costPerHour: number;
}

interface TimeRangeCostNonNull {
  start: number;
  end: number;
  state: TaskState;
  costPerHour: number;
}

/**
 * For Remote Settings, the JSON details about the attachment.
 */
interface Attachment {
  // e.g. "2f7c0f7bbc...ca79f0850c4de",
 hash: string;
 // e.g. 5047568,
 size: string;
 // e.g. "lex.50.50.deen.s2t.bin",
 filename: string;
 // e.g. "main-workspace/translations-models/316ebb3a-0682-42cc-8e73-a3ba4bbb280f.bin",
 location: string;
 // e.g. "application/octet-stream"
 mimetype: string;
}

/**
 * The JSON that is synced from Remote Settings for the translation models.
 */
interface ModelRecord {
 // e.g. "0d4db293-a17c-4085-9bd8-e2e146c85000"
 id: string;
 // The full model name, e.g. "lex.50.50.deen.s2t.bin"
 name: string;
 // The BCP 47 language tag, e.g. "de"
 fromLang: string;
 // The BCP 47 language tag, e.g. "en"
 toLang: string;
 // The semver number, used for handling future format changes. e.g. 1.0
 version: string;
 // e.g. "lex"
 fileType: string;
 // The file attachment for this record
 attachment: Attachment;
 // e.g. 1673023100578
 schema: number;
 // e.g. 1673455932527
 last_modified: string;
 // A JEXL expression to determine whether this record should be pulled from Remote Settings
 // See: https://remote-settings.readthedocs.io/en/latest/target-filters.html#filter-expressions
 filter_expression: string;
}

type LangPairStr = string
type DatasetStr = string
type TranslatorStr = string;
type ScoreNum = number;

type EvalResults = Record<LangPairStr, Record<DatasetStr, Record<TranslatorStr, ScoreNum>>>;

declare type TaskState =
  | "completed"
  | "running"
  | "failed"
  | "exception"
  | "pending"
  | "unscheduled"

interface ArtifactListing {
  taskId: string,
  totalSize: number,
  totalMonthBytes: number, // How many bytes are stored in a month
  artifacts: Array<{
    runId: number,
    path: string,
    // The size in bytes.
    size: number | null,
    monthBytes: number | null
  }>
}

/**
 * Stored in the IndexedDB.
 */
interface ArtifactText {
  taskId: string,
  path: string,
  text: string
}
