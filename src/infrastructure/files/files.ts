import { convertToCamelCase } from "@utils/stringAdapter";
import { haEntities }         from "@core/ha.constants";
import { readFileSync }       from "fs";

/**
 * Reads a CSV file and returns a JSON string.
 * The first line of the file is supposed to contain the headers.
 *
 * @param {string} filePath - The path to the CSV file to read.
 *
 * @return {object[]} A JSON string representing the content of the CSV file.
 */
export function csvToJson(filePath: string): string {
  const fileContent = readFileSync(filePath, "utf-8");
  const lines       = fileContent.split("\n");
  const headers     = lines[0].split(",").map(header => header.trim());
  const jsonData    = lines.slice(1).map(line => {
    const values = line.split(",").map(value => value.trim());
    return headers.reduce((obj: { [key: string]: string }, header: string, index: number) => {
      obj[convertToCamelCase(header)] = values[index];
      return obj;
    }, {});
  });
  return JSON.parse(JSON.stringify(jsonData, null, 2));
}

/**
 * Writes the configuration content to a YAML file for the specified Home Assistant entity type.
 *
 * Depending on the platform flag, the content is prepended with a platform-specific header.
 *
 * @param {haEntities} filename - The entity type (e.g., COVER, LIGHT, SWITCH) used to name the YAML file.
 * @param {string[]}   content  - The configuration content to write into the YAML file.
 * @param {boolean}    platform - Determines whether to include a platform header in the YAML content.
 *
 * @return {void}
 */
export async function writeConfig(filename: haEntities, content: string[], platform: boolean) {
  const plural = {
    [haEntities.COVER] : haEntities.COVER,
    [haEntities.LIGHT] : haEntities.LIGHT + "s",
    [haEntities.SWITCH]: haEntities.SWITCH + "es"
  };
  content.unshift(platform
    ? `- platform: template
  ${plural[filename]}:`
    : `- ${plural[filename]}:`
  );
  console.log(process.cwd() + process.env.YAML_FOLDER + filename + ".yaml", content.join("\n"));
  await Bun.write(process.cwd() + process.env.YAML_FOLDER + filename + ".yaml", content.join("\n"));
}