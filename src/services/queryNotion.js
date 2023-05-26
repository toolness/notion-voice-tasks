/** This module queries the user's Notion workspace and specified Projects database.
 * It returns a list of all users in the workspace and projects in the Projects database,
 * then compares those lists against each task returned from ChatGPT, picking the closest
 * matches. A threshold is set for the minimum similarity score between the task Assignee/Project
 * and the results from the users list/project database. If the similarity score is below the
 * threshold, the value will be left blank, ensuring that the task goes to a common inbox. If the
 * similarity score is above the threshold, the value will be set to the closest match.
 */

// Import dependencies
import notion from "./notionClient.js"
import Bottleneck from "bottleneck"
import Fuse from "fuse.js"
import { config } from "../config/config.js"
import retry from "async-retry"

/** Create a new taskDetails array. Task name and due are transferred over from
 *  the original object without any changes. Assignee and Project are set
 *  using the findNearestOption() function, which queries the Notion API and finds
 *  the closest option to the one provided using Fuse search.
 * */
export default async function getClosestNotionMatch(inputJSON) {
	if (typeof inputJSON !== "object" || inputJSON === null) {
		throw new Error("Invalid JSON input.")
	}

	const taskArray = []
	for (let task of inputJSON) {
		const taskDetails = {
			task: task.task_name,
			assignee: !task.assignee
				? "Not included."
				: await findNearestChoice(task.assignee, "assignee"),
			due: task.due_date || "Not included.",
			project: !task.project
				? "Not included."
				: await findNearestChoice(task.project, "projects"),
		}

		for (let prop in taskDetails) {
			if (taskDetails[prop] === "Not included.") {
				delete taskDetails[prop]
			}
		}

		taskArray.push(taskDetails)
	}

	// Return the taskArray
	return taskArray
}

/**  Query Notion (users or dbs) using the provided value (e.g. Project)
 *  Get a response from Notion, then send all rows to the closestMatch() function
 *  to find the closest match to the provided value.
 * */
async function findNearestChoice(val, type) {
	// Query Notion
	const rows = await queryNotion(type)

	// Define the query type
	const queryType = type === "assignee" ? "user" : "db"

	// Flatten the rows array
	const flatRows = rows.flat()

	// Remove bot users
	const cleanedRows = []
	for (let row of flatRows) {
		if (row.type === "person" || row.object === "page") {
			cleanedRows.push(row)
		}
	}

	// Create an new array, storing only Name and Notion Page ID of each object.
	const choiceArray = []

	for (let result of cleanedRows) {
		try {
			const choiceName =
				queryType === "db"
					? result.properties.Name.title[0].plain_text
					: result.name

			const choiceObj = {
				name: choiceName,
				id: result.id,
			}
			choiceArray.push(choiceObj)
		} catch (e) {
			console.log(e instanceof TypeError) // true
			console.log(e.message) // "null has no properties"
		}
	}

	// Find the closet option that matches the provided name
	const correctChoice = closestMatch(val, choiceArray)

	return correctChoice
}

// Query the Notion API to get a list of either all projects in the Projects db, or all users.
async function queryNotion(type) {
	// Pagination variables
	let hasMore = undefined
	let token = undefined

	// Set up our Bottleneck limiter
	const limiter = new Bottleneck({
		minTime: 333,
		maxConcurrent: 1,
	})

	// Handle 429 errors
	limiter.on("error", (error) => {
		const isRateLimitError = error.statusCode === 429
		if (isRateLimitError) {
			console.log(
				`Job ${jobInfo.options.id} failed due to rate limit: ${error}`
			)
			const waitTime = error.headers["retry-after"]
				? parseInt(error.headers["retry-after"], 10)
				: 0.4
			console.log(`Retrying after ${waitTime} seconds...`)
			return waitTime * 1000
		}

		console.log(`Job ${jobInfo.options.id} failed: ${error}`)
		// Don't retry via limiter if it's not a 429
		return
	})

	// Initial array for arrays of User or Project objects
	let rows = []

	// Query the Notion API until hasMore == false. Add all results to the rows array
	while (hasMore == undefined || hasMore == true) {
		await retry(
			async (bail) => {
				let resp

				let params = {
					page_size: 100,
					start_cursor: token,
				}

				try {
					if (type === "assignee") {
						resp = await limiter.schedule(() => notion.users.list(params))
						rows.push(resp.results)
					} else {
						params = {
							...params,
							database_id: config.notion_dbs[type],
							filter_properties: ["title"]
						}
						resp = await limiter.schedule(() => notion.databases.query(params))
						rows.push(resp.results)
					}

					hasMore = resp.has_more
					if (resp.next_cursor) {
						token = resp.next_cursor
					}
				} catch (error) {
					if (400 <= error.status && error.status <= 409) {
						// Don't retry for errors 400-409
						bail(error)
						return
					}

					if (
						error.status === 500 ||
						error.status === 503 ||
						error.status === 504
					) {
						// Retry on 500, 503, and 504
						throw error
					}

					// Don't retry for other errors
					bail(error)
				}
			},
			{
				retries: 2,
				onRetry: (error, attempt) => {
					console.log(`Attempt ${attempt} failed. Retrying...`)
				},
			}
		)
	}

	return rows
}

/* Use Fuse to find the closest match to the provided value. */
function closestMatch(val, arr, keys) {
	// Set the Fuse options
	const options = {
		keys: keys || ["name"],
		includeScore: true,
		threshold: config.search_threshold,
	}

	// Create a new Fuse object
	const fuse = new Fuse(arr, options)

	// Search for the closest match
	const result = fuse.search(val)

	if (result.length === 0) {
		return "Not included."
	} else {
		return result[0].item
	}
}
