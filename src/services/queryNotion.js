/** This module queries the user's Notion workspace and specified Projects database.
 * It returns a list of all users in the workspace and projects in the Projects database,
 * then compares those lists against each task returned from ChatGPT, picking the closest
 * matches. A threshold is set for the minimum similarity score between the task assignee/Project
 * and the results from the users list/project database. If the similarity score is below the
 * threshold, the value will be left blank, ensuring that the task goes to a common inbox. If the
 * similarity score is above the threshold, the value will be set to the closest match.
 */

// Import dependencies
import { Client } from "@notionhq/client";
import Bottleneck from 'bottleneck'

// Initialize the Notion SDK
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Set the DB IDs
const dbs = {
  tasks: process.env.NOTION_TASKS_DB,
  projects: process.env.NOTION_PROJECTS_DB,
};

// Create the query/similarity function
export default async function queryNotion(inputJSON) {
  // Get the validated JSON task array from ChatGPT
  const originalTaskDetails = JSON.parse(inputJSON);

  /** Create a new taskDetails array. Task name and due are transferred over from
   *  the original object without any changes. Assignee, Creator, and Sponsor are set
   *  using the findNearestOption() function, which queries the Notion API and finds
   *  the closest option to the one provided using Levenshtein distance.
   * */
  const taskArray = [];
  for (let task of originalTaskDetails) {
    const taskDetails = {
      task: task.task_name,
      assignee: !task.assignee
        ? "Not included."
        : await findNearestChoice(task.assignee, "assignee"),
      due: task.due_date || "Not included.",
      project: !task.proeject
        ? "Not included"
        : await findNearestChoice(task.project, "projects"),
    };

    taskArray.push(taskDetails)
  }

  // Return the taskArray
  return taskArray;
}

/**  Query Notion (users or dbs) using the provided value (e.g. Project)
 *  Get a response from Notion, then loop through and get the Levenshtein distance
 *  for each when compared to the input value.
 *  Then return the ID of the one with the lowest value.
 * */
async function findNearestChoice(val, type) {
  // Query Notion
  const rows = await queryNotion(type)

  // Define the query type
  const queryType = type === "assignee" ? "user" : "db"

  // Flatten the rows array
  const flatRows = rows.flat();
  //console.log(flatRows)
  //console.log(`Found ${flatRows.length} objects.`);

  // Remove bot users
  const cleanedRows = [];
  for (let row of flatRows) {
    if (row.type === "person" || row.object === "page") {
      cleanedRows.push(row)
    }
  }

  /* Create an new array, storing only Name, Notion Page ID, and Levenshtein distance
   *  in each object.
   */
  const choiceArray = [];

  for (let result of cleanedRows) {
    try {
      const choiceName =
        queryType === "db"
          ? result.properties.Name.title[0].plain_text
          : result.name;

      const choiceObj = {
        name: choiceName,
        id: result.id,
        distance: levenshtein.get(val, choiceName),
        first_name_distance: levenshtein.get(val, choiceName.split(" ")[0]),
      };
      choiceArray.push(choiceObj)
    } catch (e) {
      console.log(e instanceof TypeError) // true
      console.log(e.message) // "null has no properties"
    }
  }

  // Find the closet option that matches the provided name
  const correctChoice = closestMatch(choiceArray, queryType);

  return correctChoice;
}

// Query the Notion API to get a list of either all projects in the Projects db, or all users.
async function queryNotion(type) {
  // Pagination variables
  let hasMore = undefined;
  let token = undefined;

  // Set up our Bottleneck limiter
  const limiter = new Bottleneck({
    minTime: 333,
    maxConcurrent: 1
  })

  // Initial array for arrays of User or Project objects
  let rows = []

  // Query the Notion API until hasMore == false. Add all results to the rows array
  while (hasMore == undefined || hasMore == true) {
    let resp

    if (token == undefined) {
      if (type === "assignee") {
        resp = await limiter.schedule(() => notion.users.list({ page_size: 100 }))
      } else {
        resp = await limiter.schedule(() => notion.databases.query({ database_id: dbs[type], page_size: 100 }))
      }
      rows.push(resp.results);
    } else {
      if (type === "assignee") {
        resp = await limiter.schedule(() => notion.users.list({ page_size: 100, start_cursor: token }))
      } else {
        resp = await limiter.schedule(() => notion.databases.query({ database_id: dbs[type], page_size: 100, start_cursor: token }))
      }

      rows.push(resp.results)
    }

    hasMore = resp.has_more
    if (resp.next_cursor) {
      token = resp.next_cursor
    }
  }

  return rows
}
