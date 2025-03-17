import type { BaseImportedDevice, DevicesFromCSV } from "./device/device.type";
import      { csvToJson, writeConfig }             from "@infra/files/files";
import type { HaEntities }                         from "./ha.types";
import type { LightFromCSV }                       from "./light/light.types";
import type { LightWsArtNet }                      from "./light/light-Ws-ArtNet";
import type { SwitchWsArtNet }                     from "./switch/Switch-Ws-ArNet";
import      { convertToSnakeCase }                 from "src/utils/stringAdapter";
import      { haEntities }                         from "./ha.constants";
import      { readdir }                            from "node:fs/promises";
// import type { SwitchFromCSV }                      from "./switch/switch.type";
// import      { lightWsArtNet }                      from "./light/light-Ws-ArtNet";
// import      { parse }                              from "node:path";
// import      { switchWsArtNet }                     from "./switch/Switch-Ws-ArNet";
// import      { switchWsTemplate }                   from "./switch/switchHaConfigTemplate";
// import      { lightWsTemplate }                    from "./light/lightHaConfigTemplate";
// import      { CoverMqttArtNet }                    from "./cover/Cover-Mqtt-ArtNet";
// import type { SwitchArguments }              from "./switch/Switch-Ws-ArNet";
// import      { coverMqttTemplate }            from "./cover/coverHaConfigTemplate";
// import      { switchWsTemplate }             from "./switch/switchHaConfigTemplate";
// import { entities }                   from "@settings/entities";

// enum Protocols {
//   ARTNET = "ArtNet",      // eslint-disable-line no-unused-vars
//   MQTT   = "MQTT",        // eslint-disable-line no-unused-vars
//   WS     = "WS"           // eslint-disable-line no-unused-vars
// }

type RegisteredEntity = {
  [key: string]: {
    create      : Function
    useTemplate : Function
  }
}

type AvailableEntities = LightWsArtNet | SwitchWsArtNet

type Entities = { [key: string]: AvailableEntities }

const csvPath         = __dirname+"/../.." + process.env.CSV_FOLDER;
const entities        = {} as {[key:string]:Entities};
const entitiesFactory = {} as RegisteredEntity;

async function getFilesAsJSON() { //TODO use bun FS instead
  const files = {} as {[key:string]:unknown};
  const dir       = await readdir(csvPath);
  for (const file of dir.filter(file => file.endsWith(".csv"))) {
    const filename = file
      .split(" - ")[1]
      .split(".")[0]
      .toLowerCase();

    files[filename] = await csvToJson(csvPath + file);

  }
  return files as DevicesFromCSV;
}

// function reformatJson(arr:BaseImportedDevice[]) {
//   const reformated = {} as {[key:string]:{[key:string]:string|number}};
//   for (const entry of arr) {
//     const deviceId                 = getDeviceId(entry as BaseImportedDevice);
//     reformated[deviceId]           = entry;
//     reformated[deviceId].protoCode = 0; // defineProtocolCode(reformated[deviceId].haProtocol as Protocols,reformated[deviceId].outputProtocol as Protocols);

//     delete reformated[deviceId].area;
//     delete reformated[deviceId].haProtocol;
//     delete reformated[deviceId].name;
//     delete reformated[deviceId].outputProtocol;
//     delete reformated[deviceId].room;
//     delete reformated[deviceId].type;
//   }
//   return reformated;
// }

function formatString(arr:string[]) {
  return arr
    .map(convertToSnakeCase)
    .reduce((a, b) => `${a}${b ? "_"+b: ""}`);
}

function getUniqueId({ area, room, type }:BaseImportedDevice): string {
  return formatString([type, room, area]);
}

export async function importEntities(createConfig: boolean) {

  function addToWrite(haType:haEntities, value: BaseImportedDevice) { //TODO mettre LES bons types au lieu de BaseImportedDevice
    if (!createConfig) return;

    if (!filesToWrite[haType]) filesToWrite[haType] = [];

    const templateFn = entitiesFactory[value.entity]?.useTemplate;
    if (templateFn === undefined) throw new Error(`no template for ${value.entity}`);

    filesToWrite[haType].push(templateFn({
      ...value,
      uuid: getUniqueId(value as BaseImportedDevice)
    }));
  }

  function addEntity(haType:HaEntities, id:string, value:any) {
    // if (!haType in entitiesList) return;
    if (!entities[haType]) entities[haType] = {};
    entities[haType][id] = newEntity(value);
    addToWrite(haType, value);
  }

  const filesToWrite:{[key:string]:string[]} = {};

  for (const [haType, entries] of Object.entries(await getFilesAsJSON())) {

    for (const value of Object.values(entries)) {
      const deviceId = (value as any).deviceId;
      if (deviceId === undefined || deviceId === "") continue;
      switch (haType) {
        case haEntities.COVER:
          // console.log("Cover", key, value);
          // for (const [key, value] of Object.entries(entry)) {
          //   if (value.deviceId === 10) entitiesList[haType][key] = new CoverMqttArtNet(key, value);
          // }
          break;

        case haEntities.LIGHT:
          // entitiesList[haEntities.LIGHT][key] = newEntity(reformated);
          // addToWrite(haEntities.LIGHT, lightWsTemplate, reformated );
          addEntity(haEntities.LIGHT, deviceId, {
            ...value as LightFromCSV,
            dmx: parseInt((value as LightFromCSV).dmx)
          });
          break;

        case haEntities.SWITCH:
          addEntity(haEntities.SWITCH, deviceId, value);
          break;

        default:
          throw new Error(`string entity type: ${haType}`);
      }
    }
  }

  if (createConfig) {
    console.log("creating configuration files...", filesToWrite);
    for (const [haType, value] of Object.entries(filesToWrite)) {
      console.log(haType, value.length);
      if (value.length === 0) continue;
      await writeConfig(haType as haEntities, value, haType !== haEntities.COVER);
    }
    console.log("configuration files created !");
    process.exit(0);
  }
}

function newEntity(args:any) {
  const entityType = args.entity;
  if (!entityType) throw new Error("entity type is required");
  const factory = entitiesFactory[entityType];
  if ( factory === undefined) throw new Error(`entity type ${entityType} doe's not exist`);
  return factory.create(args);
}

export function registerEntity(name:string, create:Function, useTemplate:Function) {
  entitiesFactory[name] = { create, useTemplate };
}

export function getEntity(haType:string, name:string) {
  return entities[haType][name];
}