import      { haEntities, haServices, payload }         from "../ha.constants";
import      { listenWebSocket, sendMessageToWebSocket } from "@infra/websocket/websocket";
import type { SwitchArguments }                         from "./switch.type";
import type { UpdateFromSocketArgs }                    from "@infra/websocket/websocket.type";
import      { setDmx }                                  from "@infra/artnet/artnet";

export type SwitchWsArtNet = {
  isOn              : boolean
  updateAndPropagate: Function
  useAgent          : Function
}
export function switchWsArtNet(args:SwitchArguments):SwitchWsArtNet {
  const { deviceId, dmx } = args;
  let   isAgentDrived     = false;
  let   state : boolean;

  listenWebSocket(haEntities.SWITCH + "." + deviceId, updateFromSocket);

  function updateFromSocket({ newData }: UpdateFromSocketArgs) {
    const newValue = newData.state === payload.ON;
    update(newValue);
    return {
      ...makeMessage(newValue),
      context: newData.context,
    };
  }

  function makeMessage(newValue: boolean) {
    return {
      domain        : haEntities.SWITCH,
      service       : newValue ? haServices.TURN_ON : haServices.TURN_OFF,
      "service_data": {
        "entity_id": haEntities.SWITCH + "." + deviceId
      }
    };
  }

  function update(newValue: boolean) {
    dmx && setDmx(dmx, newValue ? 255 : 0);
    state = newValue;
  }

  function updateAndPropagate(newValue: boolean, fromAgent=false) {
    if (newValue === state)          return;
    if (fromAgent && !isAgentDrived) return;
    update(newValue);
    sendMessageToWebSocket(makeMessage(newValue));
  }

  function useAgent() {
    isAgentDrived = true;
  }

  return {
    get isOn() { return state; },
    updateAndPropagate,
    useAgent
  };
}