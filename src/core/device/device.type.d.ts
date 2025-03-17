import { LightFromCSV } from "../light/light.type";

export interface DevicesFromCSV {
  light ?: LightFromCSV[];
  // cover ?: Cover[];
  // switch?: Switch[];
}

export type BaseImportedDevice = {
  // [key:string] : string|number
  area     : string
  deviceId : string
  entity   : string
  name     : string
  room     : string
  type     : string
}

// export type DeviceArguments = {
//   deviceId : string
// }