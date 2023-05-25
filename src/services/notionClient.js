import { Client } from "@notionhq/client"

// Initialize the Notion SDK
const notion = new Client({ auth: process.env.NOTION_API_KEY })

export default notion