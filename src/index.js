import "./config/config.js"
import express from "express"
import parseTaskWithGPT from "./services/chatgpt.js"
import calculateGPTCost from "./services/cost.js"
import {
	validateUserInput,
	validateChatGPTResponse,
} from "./services/validate.js"
import getClosestNotionMatch from "./services/queryNotion.js"
import formatChatResponse from "./services/formatChatResponse.js"
import createNotionTasks from "./services/createNotionTasks.js"

const app = express()
const port = 3000

app.use(express.json())

app.get("/", (req, res) => {
	res.send("Hello World!")
})

// Create a POST endpoint for handling requests
app.post("/task", async (req, res) => {
	try {
		// Get the request body
		const body = req.body
		console.log("Request Body:", body)

		// Validate the request body
		const validatedBody = validateUserInput(body)

		// Parse the task with GPT
		const parsedTask = await parseTaskWithGPT(validatedBody)

		// Get the cost of the GPT request
		const cost = await calculateGPTCost(
			parsedTask.data.usage,
			parsedTask.data.model
		)

		// Validate the response from ChatGPT
		const validatedResponse = validateChatGPTResponse(
			parsedTask.data.choices[0].message.content
		)

		console.log("Results:", validatedResponse)
		console.log(`AI Cost: $${cost.toFixed(3)}`)

		// Match the response to the closest values in Notion
		const matchedResponse = await getClosestNotionMatch(validatedResponse)
		console.log("Matched Response:", matchedResponse)

        // Format the response for Notion
        const formattedResponse = formatChatResponse(matchedResponse, cost, body)
        console.log("Formatted Response:", JSON.stringify(formattedResponse, null, 2))

        // Send the tasks to Notion
        const notionResponse = await createNotionTasks(formattedResponse)
        console.log("Notion Response:", notionResponse)

		// Send a response back to the client
		res.sendStatus(200)
	} catch (error) {
		console.log(error)
		res.status(400).send({ error: error.message })
	}
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
