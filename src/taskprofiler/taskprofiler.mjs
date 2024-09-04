// @ts-check
import {
  asAny,
  encodeUintArrayForUrlComponent,
  getElement,
  getServer,
} from '../utils.mjs';
import {
  getEmptyProfile,
  getEmptyThread,
  UniqueStringArray,
  getProfile,
} from '../profiler.mjs';
import { getTasks } from '../taskcluster.mjs';

const elements = {
  formTask: /** @type {HTMLFormElement} */ (getElement('formTask')),
  formTaskGroup: /** @type {HTMLFormElement} */ (getElement('formTaskGroup')),
  fetchDependentTasks: /** @type {HTMLInputElement} */ (
    getElement('fetchDependentTasks')
  ),
  server: /** @type {HTMLInputElement} */ (getElement('server')),
  taskId: /** @type {HTMLInputElement} */ (getElement('taskId')),
  taskGroup: /** @type {HTMLInputElement} */ (getElement('taskGroup')),
  info: /** @type {HTMLDivElement} */ (getElement('info')),
  error: /** @type {HTMLDivElement} */ (getElement('error')),
};

console.log('Override the profiler origin with window.profilerOrigin');
asAny(window).profilerOrigin = 'https://profiler.firefox.com';

/**
 * @typedef {Object} LogRow
 *
 * @prop {string} component
 * @prop {Date | null} time
 * @prop {string} message
 */

/**
 * Parses log lines and returns an array of LogRow objects.
 *
 * @param {string[]} lines - The log lines to parse.
 * @returns {LogRow[]} The parsed log rows.
 */
function readLogFile(lines) {
  const logPattern =
    /\[(?<component>\w+)(:(?<logLevel>\w+))?\s*(?<time>[\d\-T:.Z]+)\]\s*(?<message>.*)/;
  // \[                                                            \]                     "[taskcluster:warn 2024-05-20T14:40:11.353Z]"
  //   (?<component>\w+)                                                                  Capture the component name, here "taskcluster"
  //                    (:(?<logLevel>\w+))?                                              An optional log level, like "warn"
  //                                        \s*                                           Ignore whitespace
  //                                           (?<time>[\d\-T:.Z]+)                       Capture the timestamp
  //                                                                 \s*                  Ignore whitespace
  //                                                                    (?<message>.*)    Capture the rest as the message

  /** @type {LogRow[]} */
  const logRows = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const match = line.match(logPattern);
    if (match && match.groups) {
      logRows.push({
        component: match.groups.component,
        time: new Date(match.groups.time),
        message: match.groups.message,
      });
    } else {
      logRows.push({
        component: '',
        time: null,
        message: line,
      });
    }
  }

  return logRows;
}

/**
 * Removes any extra datetimes from the log messages.
 *
 * @param {LogRow[]} logRows - The log rows to process.
 * @returns {LogRow[]} The modified log rows.
 */
function fixupLogRows(logRows) {
  //  Remove any extra datetimes.
  //  "[2024-05-20 15:04:26] Ep. 1 : Up. 12 : Sen. 24,225 : ..."
  //   ^^^^^^^^^^^^^^^^^^^^^

  const regex = /^\s*\[[\d\-T:.Z]\]\s*/;

  for (const logRow of logRows) {
    // Remove the date-time part from the log string
    logRow.message = logRow.message.replace(regex, '');
  }

  return logRows;
}

/**
 * Colors are listed here:
 * https://github.com/firefox-devtools/profiler/blob/ffe2b6af0fbf4f91a389cc31fd7df776bb198034/src/utils/colors.js#L96
 */
function getCategories() {
  return [
    {
      name: 'none',
      color: 'grey',
      subcategories: ['Other'],
    },
    {
      name: 'fetches',
      color: 'purple',
      subcategories: ['Other'],
    },
    {
      name: 'vcs',
      color: 'orange',
      subcategories: ['Other'],
    },
    {
      name: 'setup',
      color: 'lightblue',
      subcategories: ['Other'],
    },
    {
      name: 'taskcluster',
      color: 'green',
      subcategories: ['Other'],
    },
  ];
}

/**
 * This is documented in the profiler:
 * Markers: https://github.com/firefox-devtools/profiler/src/types/markers.js
 * Schema: https://github.com/firefox-devtools/profiler/blob/df32b2d320cb4c9bc7b4ee988a291afa33daff71/src/types/markers.js#L100
 */
function getTaskSchema() {
  return {
    name: 'LiveLogRow',
    tooltipLabel: '{marker.data.message}',
    tableLabel: '{marker.data.message}',
    chartLabel: '{marker.data.message}',
    display: ['marker-chart', 'marker-table', 'timeline-overview'],
    data: [
      {
        key: 'startTime',
        label: 'Start time',
        format: 'string',
      },
      {
        key: 'message',
        label: 'Log Message',
        format: 'string',
        searchable: true,
      },
      {
        key: 'hour',
        label: 'Hour',
        format: 'string',
      },
      {
        key: 'date',
        label: 'Date',
        format: 'string',
      },
      {
        key: 'time',
        label: 'Time',
        format: 'time',
      },
      {
        key: 'taskGroupURL',
        label: 'Task Group URL',
        format: 'url',
      },
      {
        key: 'taskGroupProfile',
        label: 'Task Group Profile',
        format: 'url',
      },
    ],
  };
}

/**
 * Builds a profile from the provided log rows.
 *
 * @param {LogRow[]} logRows - The log rows to process.
 * @param {Task} task
 * @returns {import('profiler.mjs').Profile} The generated profile.
 */
function buildProfile(logRows, task) {
  const profile = getEmptyProfile();
  profile.meta.markerSchema = [getTaskSchema()];
  profile.meta.categories = getCategories();

  // Compute and save the profile start time.
  let profileStartTime = 0;
  for (const logRow of logRows) {
    if (logRow.time) {
      profileStartTime = Number(logRow.time);
      profile.meta.startTime = profileStartTime;
    }
  }

  // Create the thread that we'll attach the markers to.
  const thread = getEmptyThread();
  thread.name = 'Live Log';
  profile.threads.push(thread);
  thread.isMainThread = true;
  const markers = thread.markers;

  // Map a category name to its index.

  /** @type {Record<string, number>} */
  const categoryIndexDict = {};
  profile.meta.categories.forEach((category, index) => {
    categoryIndexDict[category.name] = index;
  });

  const stringArray = new UniqueStringArray();

  for (const logRow of logRows) {
    if (!logRow.time) {
      continue;
    }
    const runStart = Number(logRow.time);
    const instantMarker = 0;
    markers.startTime.push(runStart - profileStartTime);

    markers.endTime.push(null);
    markers.phase.push(instantMarker);

    // Code to add a duration marker:
    // const durationMarker = 1;
    // markers.endTime.push(runEnd - profileStartTime);
    // markers.phase.push(durationMarker);

    markers.category.push(categoryIndexDict[logRow.component] || 0);
    markers.name.push(stringArray.indexForString(logRow.component));

    markers.data.push({
      type: 'LiveLogRow',
      name: 'LiveLogRow',
      message: logRow.message,
      hour: logRow.time.toISOString().substr(11, 8),
      date: logRow.time.toISOString().substr(0, 10),
      taskGroupURL: `${getServer()}/tasks/groups/${task.taskGroupId}`,
      taskGroupProfile: `https://gregtatum.github.io/taskcluster-tools/src/taskprofiler/?taskGroupId=${task.taskGroupId}`,
    });
    markers.length += 1;
  }

  thread.stringArray = stringArray.serializeToArray();

  return profile;
}

/**
 * Fetches log rows from the specified TaskCluster URL.
 *
 * @param {string} taskId - The Task ID to fetch logs for.
 * @param {Task} task
 * @returns {Promise<import('profiler.mjs').Profile>} A promise that resolves to an array of LogRow objects.
 */
async function fetchLogsAndBuildProfile(taskId, task) {
  const url = `https://firefoxci.taskcluster-artifacts.net/${taskId}/0/public/logs/live_backing.log`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const logText = await response.text();
  const logLines = logText.split('\n');

  const logRows = readLogFile(logLines);
  fixupLogRows(logRows);
  return buildProfile(logRows, task);
}

document.addEventListener('DOMContentLoaded', () => {
  {
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('taskId');
    if (taskId) {
      getProfileFromTaskId(taskId).catch((error) => console.error(error));
    }
    const taskGroupId = urlParams.get('taskGroupId');
    if (taskGroupId) {
      getProfileFromTaskGroup(taskGroupId).catch((error) =>
        console.error(error),
      );
    }
  }

  elements.server.value = getServer();

  elements.server.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      try {
        const url = new URL(elements.server.value);
        const validatedUrl = url.toString();
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('server', validatedUrl);
        replaceLocation(urlParams);
      } catch {}
    }
  });

  elements.formTask.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { value } = elements.taskId;
    if (!value) {
      return;
    }
    getProfileFromTaskId(value).catch((error) => console.error(error));
  });

  elements.formTaskGroup.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { value } = elements.taskGroup;
    if (!value) {
      return;
    }
    getProfileFromTaskGroup(value).catch((error) => console.error(error));
  });
});

/**
 * @param {string} message
 */
function updateStatusMessage(message) {
  elements.info.innerText = message;
}

/**
 * @param {import('../profiler.mjs').Profile} profile
 * @param {string} params
 */
async function injectProfile(profile, params = '') {
  const { profilerOrigin } = asAny(window);

  const profilerURL = profilerOrigin + '/from-post-message/' + params;

  const profilerWindow = window.open(profilerURL, '_blank');

  if (!profilerWindow) {
    console.error('Failed to open the new window.');
    return;
  }

  // Wait for the profiler page to respond that it is ready.
  let isReady = false;

  /**
   * @param {MessageEvent} event
   */
  const listener = ({ data }) => {
    if (data?.name === 'is-ready') {
      console.log('The profiler is ready. Injecting the profile.');
      isReady = true;
      const message = {
        name: 'inject-profile',
        profile,
      };
      profilerWindow.postMessage(message, profilerOrigin);
      window.removeEventListener('message', listener);
    }
  };

  window.addEventListener('message', listener);
  while (!isReady) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    profilerWindow.postMessage({ name: 'is-ready' }, profilerOrigin);
  }

  window.removeEventListener('message', listener);
}

/**
 * @param {string} taskId
 */
async function getProfileFromTaskId(taskId) {
  elements.info.style.display = 'block';
  elements.error.style.display = 'none';
  updateStatusMessage('Fetching the logs…');
  try {
    const taskUrl = `${getServer()}/api/queue/v1/task/${taskId}`;
    const response = await fetch(taskUrl);
    /** @type {Task} */
    const task = await response.json();
    if (!response.ok) {
      console.error(task);
      return;
    }

    const profile = await fetchLogsAndBuildProfile(taskId, task);
    console.log(profile);

    await injectProfile(profile);
  } catch (error) {
    console.error(error);
    elements.info.style.display = 'none';
    elements.error.style.display = 'block';
  }
}
/**
 * @param {string} taskGroupId
 */
async function getProfileFromTaskGroup(taskGroupId) {
  try {
    updateStatusMessage('Loading');
    elements.info.style.display = 'block';
    elements.error.style.display = 'none';

    const result = await getTasks(
      [taskGroupId],
      getServer(),
      /* merge chunks */ false,
      /* fetch dep tasks */ elements.fetchDependentTasks.checked,
      /* merge task typed */ null,
      updateStatusMessage,
      /* ignored task group ids */ new Set(),
    );

    if (!result) {
      return;
    }

    const { taskGroups } = result;
    const profile = getProfile(taskGroups, new URL(getServer()));

    const threadSelection = encodeUintArrayForUrlComponent(
      profile.threads.map((_thread, i) => i),
    );

    // By default select all the threads.
    const params = `?thread=${threadSelection}`;
    await injectProfile(profile, params);
    elements.info.style.display = 'none';
    elements.error.style.display = 'none';
  } catch (error) {
    console.error(error);
    elements.info.style.display = 'none';
    elements.error.style.display = 'block';
  }
}

/**
 * @param {URLSearchParams} urlParams
 */
function replaceLocation(urlParams) {
  const url = new URL(window.location.href);
  const newLocation = `${url.origin}${url.pathname}?${urlParams}`;
  history.replaceState(null, '', newLocation);
}