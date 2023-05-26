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
		// Get the timestamp at the start of the workflow
        const start = Date.now()
        
        // Get the request body
		const body = req.body
        console.log("Received a new request.")
		console.log("Request Body:", body)

		// Validate the request body
        console.log("Validating the request body.")
		const validatedBody = validateUserInput(body)
        console.log("Body validation complete.")

		// Parse the task with GPT
        console.log("Parsing the task with GPT.")
		const parsedTask = await parseTaskWithGPT(validatedBody)
        console.log("GTP parsing complete.")

		// Get the cost of the GPT request
        console.log("Calculating the cost of the GPT request.")
		const cost = await calculateGPTCost(
			parsedTask.data.usage,
			parsedTask.data.model
		)
        console.log("Cost calculation complete.")

		// Validate the response from ChatGPT
        console.log("Validating the response from ChatGPT.")
		const validatedResponse = validateChatGPTResponse(
			parsedTask.data.choices[0].message.content
		)
        console.log("Response validation complete.")

		console.log("Results:", validatedResponse)
		console.log(`AI Cost: $${cost.toFixed(3)}`)

		// Match the response to the closest values in Notion
        console.log("Matching the response to the closest values in Notion.")
		const matchedResponse = await getClosestNotionMatch(validatedResponse)
        console.log("Response matching complete.")
		console.log("Matched Response:", matchedResponse)

        // Format the response for Notion
        console.log("Formatting the response for Notion.")
        const formattedResponse = formatChatResponse(matchedResponse, cost, body)
        console.log("Response formatting complete.")
        console.log("Formatted Response:", JSON.stringify(formattedResponse, null, 2))

        // Send the tasks to Notion
        console.log("Sending the tasks to Notion.")
        const notionResponse = await createNotionTasks(formattedResponse)
        console.log("Notion request complete.")
        console.log("Notion Response:", notionResponse)

		// Get the timestamp at the end of the workflow
        const end = Date.now()

        // Calculate the total time taken
        const totalTime = (end - start) / 1000
        
        // Send a response back to the client
        console.log("Sending a confirmation back to the client.")
		res.status(200).send(`Success! Created ${notionResponse.length} tasks in Notion. Operation took ${totalTime} seconds and cost $${cost.toFixed(4)} to complete.`)
	} catch (error) {
		console.log(error)
		res.status(400).send({ error: error.message })
	}
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
