// @ts-check

const elements = {
  taskGroup: /** @type {HTMLInputElement} */ (getElement("taskGroup")),
  mergeChunks: /** @type {HTMLInputElement} */ (getElement("mergeChunks")),
  server: /** @type {HTMLInputElement} */ (getElement("server")),
  graph: getElement("graph"),
  info: getElement("info"),
  controls: getElement("controls"),
  infoMessage: getElement("info-message"),
}

setupHandlers()
getTasks()
  .then((tasks) => {
    if (tasks) {
      render(tasks);
    }
  }).catch(error => console.error(error))

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function getElement(id) {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error("Could not find element " + id);
  }
  return element;
}

/**
 * @param {URLSearchParams} urlParams
 */
function changeLocation(urlParams) {
  const url = new URL(window.location.href);
  const newLocation = `${url.origin}${url.pathname}?${urlParams}`;

  // @ts-ignore
  window.location = newLocation
}

function setupHandlers() {
  elements.server.value = getServer();
  elements.server.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      try {
        const url = new URL(elements.server.value);
        const validatedUrl = url.toString();
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('server', validatedUrl)
        changeLocation(urlParams)
      } catch {

      }
    }
  })

  elements.taskGroup.addEventListener('keydown', (event) => {
    const taskGroupId = /** @type {HTMLInputElement } */ elements.taskGroup.value
    if (event.key === 'Enter' && taskGroupId) {
      if (!isTaskGroupIdValid(taskGroupId)) {
        alert("The task group id was not valid")
        return;
      }
      const ids = getTaskGroupIds()
      ids.push(taskGroupId);

      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('taskGroupIds', ids.join(','))
      changeLocation(urlParams)
    }
  });

  elements.mergeChunks.checked = getIsMergeChunks()
  elements.mergeChunks.addEventListener("click", () => {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('mergeChunks', elements.mergeChunks.checked.toString())
    changeLocation(urlParams)
  })

  for (const taskGroupId of getTaskGroupIds()) {
    const div = document.createElement("div");
    const closeButton = document.createElement("button");
    const a = document.createElement("a");

    closeButton.className = "closeButton"
    closeButton.setAttribute("title", "Remove the task group");
    closeButton.innerText = "𝗫"
    closeButton.addEventListener("click", () => {
      let ids = getTaskGroupIds()
      ids = ids.filter(id => id !== taskGroupId);

      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('taskGroupIds', ids.join(','))
      changeLocation(urlParams)
    })
    div.appendChild(closeButton);

    const span = document.createElement("span");
    span.innerText = "Task Group: ";
    div.appendChild(span);

    a.innerText = taskGroupId;
    a.setAttribute(
      "href",
      `${getServer()}/tasks/groups/${taskGroupId}`
    );
    div.appendChild(a);

    // Add it to the page.
    elements.controls.insertBefore(div, elements.mergeChunks.parentElement);
  }

  for (const mergeTaskType of getMergeTaskTypes() ?? []) {
    const div = document.createElement("div");
    const closeButton = document.createElement("button");

    closeButton.className = "closeButton"
    closeButton.setAttribute("title", "Remove the merge task group");
    closeButton.innerText = "𝗫"
    closeButton.addEventListener("click", () => {
      let taskTypes = getMergeTaskTypes() ?? []
      taskTypes = taskTypes.filter(id => id !== mergeTaskType);

      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('mergeTaskType', [...new Set(taskTypes)].join(','))
      changeLocation(urlParams)
    })
    div.appendChild(closeButton);

    const span = document.createElement("span");
    span.innerText = "Merge: ";
    div.appendChild(span);

    const b = document.createElement("b");
    b.innerText = `"${mergeTaskType}"`;
    div.appendChild(b);

    // Add it to the page.
    elements.controls.insertBefore(div, elements.mergeChunks.parentElement);
  }
}

/**
 * Should the task chunks be merged?
 *
 * @returns {boolean}
 */
function getIsMergeChunks() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("mergeChunks") === "true"
}

function getMergeTaskTypes() {
  const urlParams = new URLSearchParams(window.location.search);
  const text = urlParams.get("mergeTaskType")
  if (text) {
    return [...new Set(text.split(","))]
  }
  return null;
}

function getServer() {
  const urlParams = new URLSearchParams(window.location.search);
  const text = urlParams.get("server")
  if (!text) {
    return "https://firefox-ci-tc.services.mozilla.com"
  }
  try {
    const url = new URL(text);
    return url.toString();
  } catch(error) {
    return "https://firefox-ci-tc.services.mozilla.com";
  }
}


/**
 * @param {string} id
 */
function isTaskGroupIdValid(id) {
  return id.match(/^[a-zA-Z0-9_-]+$/)
}

/**
 * @returns {string[]}
 */
function getTaskGroupIds() {
  const urlParams = new URLSearchParams(window.location.search);
  // Extract the taskGroupId parameter
  const taskGroupIdParam = urlParams.get('taskGroupIds');

  // "PuI6mYZPTUqAfyZMTgeUng", "S5E71GihQM6Te_KdrUmATw"

  if (!taskGroupIdParam) {
    return [];
  }

  // Parse the taskGroupId values into an array
  const taskGroupIds = taskGroupIdParam.split(',');
  return taskGroupIds
}

/**
 * @param {Task[]} tasks
 * @return {Task[]}
 */
function mergeChunks(tasks) {
  /** @type {Task[]} */
  const mergedTasks = [];
  /** @type {Map<string, Task>} */
  const keyToMergedTask = new Map();
  /** @type {Map<string, string>} */
  const taskIdToMergedId = new Map();
  for (const task of tasks) {
    const { label } = task.task.tags

    const chunkResult = label?.match(/(.*)-\d+\/\d+$/);
    if (chunkResult) {
      // This is a chunk that needs merging.
      const newLabel = chunkResult[1];
      const key = "(chunk)-" + newLabel;
      const mergedTask = keyToMergedTask.get(key);

      if (mergedTask) {
        // The task exists already, add the runs to it.
        taskIdToMergedId.set(task.status.taskId, mergedTask.status.taskId)

        // Merge the runs.
        mergedTask.status.runs = [
          ...(mergedTask.status.runs ?? []),
          ...(task.status.runs ?? []),
        ];
        mergedTask.task.dependencies = [...new Set([
          ...mergedTask.task.dependencies,
          ...task.task.dependencies
        ])]
      } else {
        // Create the start of a merged task.
        task.task.tags.label = newLabel;
        keyToMergedTask.set(key, task);
        mergedTasks.push(task);
      }
    } else {
      // No merging is needed.
      mergedTasks.push(task)
    }
  }

  for (const task of mergedTasks) {
    task.task.dependencies = task.task.dependencies.map(id =>
      taskIdToMergedId.get(id) ?? id
    );
  }

  return mergedTasks;
}

/**
 * @param {Task[]} tasks
 * @param {string} mergeTaskType
 * @return {Task[]}
 */
function doMergeTaskTypes(tasks, mergeTaskType) {
  /** @type {Task[]} */
  const mergedTasks = [];
  /** @type {Map<string, Task>} */
  const keyToMergedTask = new Map();
  /** @type {Map<string, string>} */
  const taskIdToMergedId = new Map();

  for (const task of tasks) {
    const { label } = task.task.tags

    let isMerged = false;
    if (label?.startsWith(mergeTaskType + "-")) {
      // Create a key that knows about dependents.
      const key = "(taskType)-" + mergeTaskType;
      const mergedTask = keyToMergedTask.get(key);

      if (mergedTask) {
        // The task exists already, add the runs to it.
        taskIdToMergedId.set(task.status.taskId, mergedTask.status.taskId)

        // Only apply the merged label when things are merged.
        mergedTask.task.tags.label = mergeTaskType + " (merged)";

        // Merge the runs.
        mergedTask.status.runs = [
          ...(mergedTask.status.runs ?? []),
          ...(task.status.runs ?? []),
        ];
        mergedTask.task.dependencies = [...new Set([
          ...mergedTask.task.dependencies,
          ...task.task.dependencies
        ])]
      } else {
        keyToMergedTask.set(key, task);
        mergedTasks.push(task);
      }

      isMerged = true;
    }

    if (!isMerged) {
      // No merging is needed.
      mergedTasks.push(task)
    }
  }

  for (const task of mergedTasks) {
    task.task.dependencies = task.task.dependencies.map(id =>
      taskIdToMergedId.get(id) ?? id
    );
  }

  return mergedTasks;
}

/**
 * @returns {Promise<Task[] | null>}
 */
async function getTasks() {
  const taskGroupIds = getTaskGroupIds();
  if (!taskGroupIds.length) {
    return null;
  }

  // Validate the taskGroupIds
  if (taskGroupIds.length && taskGroupIds.some(id => !isTaskGroupIdValid(id))) {
    const p = document.createElement("p")
    p.innerText = "A task group id was not valid, " + JSON.stringify(taskGroupIds)
    document.body.appendChild(p)
    throw new Error(p.innerText);
  }

  console.log("Using the following taskGroupIds", taskGroupIds);

  elements.infoMessage.innerText = "Fetching the tasks…"

  /** @type {Array<Promise<TaskGroup>>} */
  const taskGroupPromises = taskGroupIds.map(id =>
    fetch(`${getServer()}/api/queue/v1/task-group/${id}/list`)
      .then((response) => response.json())
  );

  /** @type {Task[]} */
  let tasks = []
  for (const {tasks: tasksList} of await Promise.all(taskGroupPromises)) {
    for (const task of tasksList) {
      tasks.push(task)
    }
  }

  mutateAndRemoveMissingDependencies(tasks)

  if(getIsMergeChunks()) {
    tasks = mergeChunks(tasks)
  }

  mutateAndRemoveMissingDependencies(tasks)

  const mergeTaskTypes = getMergeTaskTypes()
  if (mergeTaskTypes) {
    for (const mergeTaskType of mergeTaskTypes) {
      tasks = doMergeTaskTypes(tasks, mergeTaskType)
    }
  }

  return tasks;
}

/**
 * @param {Task[]} tasks
 */
function mutateAndRemoveMissingDependencies(tasks) {
  // Figure out which taskIds are actually present.
  const presentTaskIds = new Set();
  for (const task of tasks) {
    const { taskId } = task.status
    presentTaskIds.add(taskId);
  }

  // Remove any dependencies that aren't present.
  for (const task of tasks) {
    task.task.dependencies = task.task.dependencies.filter(
      id => presentTaskIds.has(id)
    )
  }
}

/**
 * @param {Task[]} tasks
 * @return {Map<string, string[]>}
 */
function getDependentsMap(tasks) {
  /** @type {Map<string, string[]>} */
  const dependentsMap = new Map();
  for (const task of tasks) {
    const { taskId } = task.status
    for (const dependency of task.task.dependencies) {
      let list = dependentsMap.get(dependency);
      if (!list) {
        list = [];
        dependentsMap.set(dependency, list);
      }
      list.push(taskId)
    }
  }
  for (const list of dependentsMap.values()) {
    list.sort((a,b) => a.localeCompare(b))
  }
  return dependentsMap
}

/**
 * @param {Task[]} tasks
 */
function render(tasks) {
  if (tasks.length === 0) {
    elements.infoMessage.innerText = "There were no tasks in the task group";
    return;
  }
  console.log("tasks", tasks)
  elements.info.style.display = "none"

  for (const task of tasks) {
    const match = task.task.tags.label?.match(/^all-(\w+)-(\w+)$/);
    if (match) {
      const src = match[1];
      const trg = match[2];
      const div = document.createElement("div");
      div.id = "trainingRun"
      div.innerHTML = `Training run: <b>${src}-${trg}</b>`

      elements.controls.append(div);
      break;
    }
  }

  // Specify the dimensions of the chart.
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Specify the color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  /**
   * @param {Task} task
   * @param {number} count
   */
  function getTaskType(task, count) {
    const { label } = task.task.tags
    if (!label) {
      return "";
    }
    const parts = label.split("-");
    if (parts.length < count) {
      return "";
    }
    return parts.slice(0, count).join("-")
  }

  const types = [...new Set(tasks.map(task => getTaskType(task, 1)))]

  /**
   * This node function exists so that Typescript can infer the type.
   * @param {Task} task
   */
  function makeNode(task) {
    const { runs } = task.status;
    if (!runs) {
      throw new Error("Expected a run.");
    }

    let duration = 0;
    let start = Infinity;
    let end = 0;

    for (const {started, reasonResolved, resolved} of runs) {
      if (reasonResolved === "completed") {
        const runStart = new Date(started).valueOf()
        const runEnd = new Date(resolved).valueOf();
        duration += runEnd - runStart
        start = Math.min(start, runStart);
        end = Math.max(end, runEnd);
      }
    }
    if (start === Infinity) {
      throw new Error("Could not find a start.");
    }
    if (end === 0) {
      throw new Error("Could not find an end.");
    }

    // const start = new Date(runs[0].started).valueOf();
    // const end = new Date(runs[0].resolved).valueOf();
    // const duration = end - start;

    const label = task.task.tags.label ?? task.task.metadata.name
    const taskType = getTaskType(task, 1);

    return {
      id: task.status.taskId,
      x: Math.random() * width,
      y: Math.random() * height,
      duration,
      label,
      start,
      end,
      taskType,
      taskType2: getTaskType(task, 2),
      taskType3: getTaskType(task, 3),
      dependencies: task.task.dependencies,
      group: types.findIndex(type => type === taskType),
      task,
    };
  }

  /**
   * @typedef {ReturnType<makeNode>} Node
   */

  /** @type {Array<Node | null>} */
  const nodesMaybe = tasks.map((task) => {
    const { runs } = task.status;
    if (!runs || !runs.length || !runs[0].started || !runs[0].resolved) {
      return null;
    }
    // Only run on completed runs.
    if (runs.some(run => run.reasonResolved === "completed")) {
      return makeNode(task)
    }
    return null;
  });

  // For some reason typescript isn't inferring the filter correctly, but this does
  // the trick.
  const nodes = nodesMaybe.filter(node => node !== null).map(node => {
    if (!node) {
      throw new Error("Node found when not expected.");
    }
    return node
  })

  console.log("Nodes", nodes);

  /** @type {number[]} */
  const durations = nodes.map((node) => node.duration);
  const starts = nodes.map((node) => node.start);
  const ends = nodes.map((node) => node.end);

  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const minStart = Math.min(...starts)
  const maxStart = Math.max(...starts)
  const endRange = Math.max(...ends)
  const totalDuration = endRange - minStart

  const links = nodes.flatMap((node) =>
    node.dependencies
      .filter((dependency) => nodes.some((node) => node.id === dependency))
      .map((dependency) => ({
        source: dependency,
        target: node.id,
      })),
  );

  /**
   * @typedef {d3.SimulationNodeDatum} SimulationNodeDatum
   */

  /**
   * Work around a type definition issue.
   * @param {(node: Node) => any} callback
   * @returns {(d: d3.SimulationNodeDatum) => any}
   */
  function dAsNode(callback) {
    /** @type {any} */
    const anyCallback = callback
    return anyCallback;
  }

  // Create a simulation with several forces.
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3.forceLink(links).id(dAsNode((d) => d.id))
        .distance((d) => {
          const sourceNode = nodes.find((node) => node.id === d.source.id);
          const targetNode = nodes.find((node) => node.id === d.target.id);
          if (!sourceNode) {
            throw new Error("Could not find source node.");
          }
          if (!targetNode) {
            throw new Error("Could not find source node.");
          }
          const totalDuration = maxDuration - minDuration
          const averageDuration = (sourceNode.duration + targetNode.duration) / totalDuration;
          return 10 + 300 * averageDuration; // Adjust the base distance and factor as needed.
        }),
    )
    .force("charge", d3.forceManyBody())
    .force("forceX", d3.forceX(dAsNode(d => {
      const margin = 0.2
      const duration = maxStart - minStart
      return width * margin + (d.start - minStart) / duration * (width * (1 - margin * 2));
    })).strength(0.08))
    // })
    .force("forceY", d3.forceY(height/2).strength(0.08) )
    .on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => {
          const radius = getNodeRadius(d.target) + 3
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx ** 2 + dy ** 2)
          const t = (dist - radius) / dist
          return d.source.x + t * dx;
        })
        .attr("y2", (d) => {
          const radius = getNodeRadius(d.target) + 3
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx ** 2 + dy ** 2)
          const t = (dist - radius) / dist
          return d.source.y + t * dy;
        });

      label
        .attr("x", (d) => d.x)
        .attr("y", (d) => d.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    });

  // Create the SVG container.
  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

  /**
   * @param {Node} d
   */
  function getNodeRadius(d) {
    const range = maxDuration - minDuration;
    return 7 + (d.duration / range) * 30;
  }

  // Add a line for each link, and a circle for each node.
  const link = svg
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll()
    .data(links)
    .join("line")
    .attr("stroke-width", 1)
    .attr("marker-end", "url(#arrowhead)");

  const node = svg
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .selectAll()
    .data(nodes)
    .join("circle")
    .attr("r", getNodeRadius)
    .attr("fill", (d) => color(d.group))
    .on("mouseover", (event, d) => {
      label.filter(labelD => labelD.id === d.id).style("opacity", 1);
    })
    .on("mouseout", (event, d) => {
      label.filter(labelD => labelD.id === d.id).style("opacity", 0);
    })
    .on("dblclick", (event, d) => {
      window.open(
        `${getServer()}/tasks/${d.id}`,
        '_blank'
      )
    })
      // Function to handle right-click context menu
    .on("contextmenu", (event, d) => {
      // Prevent the default context menu from appearing
      event.preventDefault();
      const node = /** @type {Node} */(/** @type {any} */ (d));

      const actions = [
        {
          label: `Open task <b>"${node.id}"</b>`,
          action() {
            window.open(
              `${getServer()}/tasks/${node.id}`,
              '_blank'
            )
          }
        },
        {
          label: `Open task group <b>"${node.task.status.taskGroupId}"</b>`,
          action() {
            window.open(
              `${getServer()}/tasks/groups/${node.task.status.taskGroupId}`,
              '_blank'
            )
          }
        },
        getMergeAction(node.taskType),
      ];
      if (node.taskType2) {
        actions.push(getMergeAction(node.taskType2));
      }
      if (node.taskType3) {
        actions.push(getMergeAction(node.taskType3));
      }
      actions.push({
        label: "Log task data",
        action() {
          console.log(node.task)
        }
      })

      /**
       * @param {string} taskType
       */
      function getMergeAction(taskType) {
        return {
          label: `Merge <b>"${taskType}"</b>`,
          action() {
            const urlParams = new URLSearchParams(window.location.search);
            const mergesRaw = urlParams.get('mergeTaskType');
            const merges = mergesRaw ? mergesRaw.split(",") : [];
            merges.push(taskType);
            urlParams.set('mergeTaskType', merges.join(','))
            changeLocation(urlParams)
          }
        }
      }

      // Create a context menu
      const contextMenu = d3.select("body")
        .append("div")
        .attr("class", "context-menu")
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 5) + "px")
        .selectAll("a")
          .data(actions)
          .enter()
          .append("a")
          .attr("href", "#")
          .attr("class", "context-menu-item")
          .html((item) => item.label)
          .on("click", (event, item) => {
            event.preventDefault();
            item.action()
            document.querySelector(".context-menu")?.remove()
          })

      // Add an event listener to close the context menu when clicking outside of it
      d3.select("body").on("click.context-menu", function() {
        document.querySelector(".context-menu")?.remove()
        d3.select("body").on("click.context-menu", null); // Remove the click event listener
      });
    });

  // Add a drag behavior.
  node.call(
    d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended),
  );

  const label = svg
     .selectAll(null)
     .data(nodes)
     .enter()
     .append("text")
     .text((d) => d.label)
     .attr("font-size", 12)
     .attr("dx", 15)
     .attr("dy", 4)
     .style("pointer-events", "none")
     .style("opacity", 0)
     .style("font-family", "sans-serif")
     .style("filter", "url(#solid)");

  svg
    .append("defs")
    .html(`
      <marker id="arrowhead" viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,-5L10,0L0,5" fill="#999" />
      </marker>
    `);

  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
  }

  // Update the subject (dragged node) position during drag.
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it’s no longer being dragged.
  function dragended(event) {
    // if (!event.active) simulation.alphaTarget(0);
    // event.subject.fx = null;
    // event.subject.fy = null;
  }


  // Reorder nodes and labels
  svg.selectAll("text").raise();

  svg.append("defs")
    .html(`
      <filter x="0" y="0" width="1" height="1" id="solid">
        <feFlood flood-color="white" result="bg" />
        <feMerge>
          <feMergeNode in="bg"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `);


  elements.graph.appendChild(svg.node());
}
