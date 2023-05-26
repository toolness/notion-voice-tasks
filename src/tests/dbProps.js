/** 
 * Interesting finding: The standard "Name" property (which has the type "title"), always has the ID "title".
 * This means you can add a property filter to only fetch the Name property without needing to first make a 
 * call to the database to get the ID of the Name property. It's always "title".
 * 
 * I am still unsure as to whether making a filtered call like this will improve the speed of the workflow, but it does
 * mean that we can avoid pulling in property values that are not needed, which is a privacy/security improvement.
 */

import "../config/config.js"
import notion from "../services/notionClient.js"

(async () => {
    const databaseId = process.env.NOTION_PROJECTS_DB
    const response = await notion.databases.retrieve({ database_id: databaseId });
    console.log(JSON.stringify(response, null, 2));
  })();

