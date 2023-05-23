import './config/config.js'
import express from 'express'
import parseTaskWithGPT from './services/chatgpt.js'
import calculateGPTCost from './services/cost.js'
import { validateUserInput, validateChatGPTResponse } from './services/validate.js'

const app = express()
const port = 3000

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// Create a POST endpoint for handling requests
app.post('/task', async (req, res) => {
    try {
        // Get the request body
        const body = req.body
        console.log("Request Body:", body)
        
        // Validate the request body
        const validatedBody = validateUserInput(body)

        // Parse the task with GPT
        const parsedTask = await parseTaskWithGPT(validatedBody)

        // Get the cost of the GPT request
        const cost = await calculateGPTCost(parsedTask.data.usage, parsedTask.data.model)

        // Validate the response from ChatGPT
        const validatedResponse = validateChatGPTResponse(parsedTask.data.choices[0].message.content)

        console.log("Results:", validatedResponse)
        console.log("Cost", cost)

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