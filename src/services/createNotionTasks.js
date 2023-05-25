/**
 * This module sends each task object in the provided taskArray to the Notion API,
 * createing new tasks in the Task database. It then returns the response
 * from the Notion API.
 */

// Import dependencies
import notion from "./notionClient.js"
import Bottleneck from "bottleneck"
import { config } from "../config/config.js"
import retry from "async-retry"

// Create a Bottleneck limiter
const limiter = new Bottleneck({
	maxConcurrent: 1,
	minTime: 333,
})

// Handle 429 errors
limiter.on("error", (error) => {
	const isRateLimitError = error.statusCode === 429
	if (isRateLimitError) {
		console.log(`Job ${jobInfo.options.id} failed due to rate limit: ${error}`)
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

export default async function createNotionTasks(formattedArray) {
	try {
		const results = await Promise.all(
			formattedArray.map(
				async (task) => {
					return retry(async (bail) => {
						try {
							const response = await limiter.schedule(() =>
								notion.pages.create(task)
							)
							return response
						} catch (error) {
							if (400 <= error.status && error.status <= 409) {
								// Don't retry for errors 400-409
								console.log("Error creating Notion task:", error)
								bail(error)
							} else if (
								error.status === 500 ||
								error.status === 503 ||
								error.status === 504
							) {
								// Retry for 500, 503, and 504 errors
								console.log("Error creating Notion task:", error)
								throw error
							} else {
								console.log("Error creating Notion task:", error)
								throw error
							}
						}
					})
				},
				{
					retries: 3,
					onRetry: (error) =>
						console.log("Retrying Notion task creation:", error),
				}
			)
		)
		return results
	} catch (error) {
		console.error("Error creating Notion tasks:", error)
	}
}
