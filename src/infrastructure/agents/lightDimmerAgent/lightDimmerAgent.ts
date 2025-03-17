import      { haEntities, haServices }    from "@core/ha.constants";
import type { LightDimmerAgentArguments } from "./lightDimmerAgent.type";
import type { UpdateFromSocketArgs }      from "@infra/websocket/websocket.type";
import      { listenWebSocket }           from "@infra/websocket/websocket";

export enum Modes {  //exported for making configuration
  LUMINOSITY = "luminosity",
  OFF        = "off",
  ON         = "on",
  SIFTED     = "sifted"
}

export function LightDimmerAgent({ inputSelectEntity, presets }:LightDimmerAgentArguments) {

  listenWebSocket(haEntities.LIGHT + "." + inputSelectEntity, updateFromSocket);

  function updateFromSocket({ newData, isEvent }: UpdateFromSocketArgs) {
    return {
      domain        : haEntities.INPUT_SELECT,
      service       : haServices.UPDATE_ENTITY,
      "service_data": {
        "entity_id": haEntities.INPUT_SELECT + "." + inputSelectEntity,
        // brightness : newData.attributes.brightness,
        // state      : newData.state
      }
    };
  }

  function updateInput({ newData }: UpdateFromSocketArgs) {

}