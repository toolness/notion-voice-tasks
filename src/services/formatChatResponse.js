/**
 * This module takes the array of modified task objects returned from
 * the queryNotion module and creates a new array objects tailored for
 * the Notion API. It also takes in the cost and the original request
 * body as arguments, adding them as child blocks to the Notion task
 * page that will be created.
 */

/**
 * To-do:
 * - Add dynamic property names, pulling from config file
 */

import { config } from "../config/config.js"

function creatNotionObject(
	result,
	cost,
	body,
	source = config.default_workflow_source
) {
	// Format the cost
	const costString = `$${cost.toFixed(4)}`

	return {
		parent: {
			database_id: process.env.NOTION_TASKS_DB,
		},
		properties: {
			Name: {
				title: [
					{
						text: {
							content: result.task,
						},
					},
				],
			},
			Source: {
				select: {
					name: source,
				},
			},
			...(result.assignee && {
				Assignee: {
					people: [
						{
							id: result.assignee.id,
						},
					],
				},
			}),
			...(result.due && {
				Due: {
					date: {
						start: result.due,
					},
				},
			}),
			...(result.project && {
				Project: {
					relation: [
						{
							id: result.project.id,
						},
					],
				},
			}),
		},
		children: [
			{
				object: "block",
				type: "callout",
				callout: {
					icon: {
						emoji: "🤖",
					},
					color: "blue_background",
					rich_text: [
						{
							text: {
								content: `This task was created via the ${source}. The cost of this request was ${costString}.`,
							},
						},
					],
					children: [
						{
							paragraph: {
								rich_text: [
									{
										type: "text",
										text: {
											content:
												"Full request details for this task (may contain other tasks):",
										},
									},
								],
							},
						},
						{
							code: {
								language: "json",
								rich_text: [
									{
										type: "text",
										text: {
											content: JSON.stringify(body, null, 2),
										},
									},
								],
							},
						},
					],
				},
			},
		],
	}
}

export default function formatChatResponse(resultsArray, cost, body, source) {
	return resultsArray.map((result) =>
		creatNotionObject(result, cost, body, source)
	)
}
