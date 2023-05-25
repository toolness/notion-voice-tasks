import Joi from "joi"
import validator from "validator"
import dayjs from "dayjs"
import { jsonrepair } from "jsonrepair"

// Function to validate the user input from Shortcuts, Tasker, etc.
export function validateUserInput(data) {
	// Define the Joi schema for each property in the data
	const scheme = Joi.object({
		task: Joi.string()
			.pattern(new RegExp("^[a-zA-Z0-9.,!?;$ ]*$"))
			.message("Task must only contain letters, numbers, and punctuation.")
			.required(),
		name: Joi.string()
			.max(50)
			.message("Name must be 50 characters or less.")
			.required(),
		date: Joi.string()
			.isoDate()
			.message("Date must be a string in ISO 8601 format.")
			.required(),
	})

	// Construct the date object and check its validity
	const dateObject = dayjs(validator.escape(data.date))
	if (!dateObject.isValid()) {
		throw new Error("Invalid date format.", dateObject)
	}

	// Construct the data object
	const dataObject = {
		task: validator.escape(data.task),
		name: validator.escape(data.name),
		date: dateObject.toISOString(),
	}

	// Validate the data against the schema
	const { error, value } = scheme.validate(dataObject)

	// If there is an error, return the error message
	if (error) {
		throw new Error("Invalid data: " + error.message)
	}

	// If there is no error, return the validated data
	return value
}

// Validate the response from the ChatGPT API. Attempt JSON repair if needed.
export function validateChatGPTResponse(response) {
	const responseArrayString = response

	// Check if the response if valid JSON
	let responseArray
	try {
		responseArray = JSON.parse(responseArrayString)
	} catch {
		// If the response is not valid JSON, attempt to repair it
		try {
			const repairedJSON = repairJSON(responseArrayString)
			responseArray = JSON.parse(repairedJSON)
		} catch {
			// If the response is not valid JSON after repair, throw an error
			throw new Error("Invalid JSON response from ChatGPT.")
		}
	}

	// Return the response array
	return responseArray
}

/** Strip non-JSON text from the response, then run jsonrepair. Typically, not needed since ChatGPT has always returned valid JSON since
 * I added an example to the system instructions, but I'm including it as an insurance policy.
 * */
function repairJSON(input) {
	// Find the first { or [ and the last } or ]
	const beginningIndex = Math.min(
		input.indexOf("{") !== -1 ? input.indexOf("{") : Infinity,
		input.indexOf("[") !== -1 ? input.indexOf("[") : Infinity
	)
	const endingIndex = Math.max(
		input.lastIndexOf("}") !== -1 ? input.lastIndexOf("}") : -Infinity,
		input.lastIndexOf("]") !== -1 ? input.lastIndexOf("]") : -Infinity
	)

	// If no JSON object or array is found, throw an error
	if (beginningIndex == Infinity || endingIndex == -1) {
		throw new Error("No JSON object or array found.")
	}

	// Extract the JSON string from any non-JSON text sandwiching it, then run it through jsonrepair to fix any errors
	const JSONString = jsonrepair(
		input.substring(beginningIndex, endingIndex + 1)
	)

	// Return the repaired JSON string
	return JSONString
}
