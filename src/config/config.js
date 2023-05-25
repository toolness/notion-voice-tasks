import * as dotenv from "dotenv"
dotenv.config()

export const config = {
	maxtokens:
		Number(process.env.MAX_TOKENS) > 2000
			? 2000
			: Number(process.env.MAX_TOKENS) || 2000,
	model: "gpt-3.5-turbo",
	search_threshold: 0.4,
}
