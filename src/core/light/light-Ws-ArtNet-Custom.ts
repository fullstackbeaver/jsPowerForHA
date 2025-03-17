import      { dmxTransitionInterval, getSteps }         from "@utils/transitions";
import      { haEntities, haServices }                  from "../ha.constants";
import      { listenWebSocket, sendMessageToWebSocket } from "@infra/websocket/websocket";
import type { LightArguments }                          from "./light.types";
import type { LightWsArtNet }                           from "./light-Ws-ArtNet";
import type { SwitchState }                             from "../ha.types";
import type { SwitchWsArtNet }                          from "@core/switch/Switch-Ws-ArNet";
import type { UpdateFromSocketArgs }                    from "@infra/websocket/websocket.type";
import      { getEntity }                               from "@core/entities";
import      { payload }                                 from "@core/ha.constants";
import      { setDmx }                                  from "@infra/artnet/artnet";

export function lightWsArtNetCustom(args: LightArguments):LightWsArtNet {
  const deviceId   = args.deviceId;
  const dmxAddress = args.dmx;
  const max        = args.max ? Math.round((255 * args.max) / 100) : undefined;
  let context: any;  //TODO change type
  let isAgentDrived   = false;
  let transitionSteps = [] as number[];
  let transtion: NodeJS.Timer | undefined;
  let value    : number;

  listenWebSocket(haEntities.LIGHT + "." + deviceId, updateFromSocket);

  function updateFromSocket({ newData, isEvent }: UpdateFromSocketArgs) {
    isAgentDrived = false;
    const target = getValueNewValue({
      brightness: newData.attributes.brightness,
      state     : newData.state
    });
    context = newData.context;
    if (isEvent) {
      updateValueWithTransition(target);
      return {};
    }
    value = target;
    return updateValueAndMakeMessage();
  }

  function updateValueWithTransition(newValue: number) {
    const powerRelay = getEntity(haEntities.SWITCH, "cellier_relais_puissance_eclairage") as SwitchWsArtNet;
    powerRelay.updateAndPropagate(true);
    if (newValue !== value) {
      clearInterval(transtion);
      transitionSteps = getSteps(value, newValue);
      transtion       = setInterval(useTransition, dmxTransitionInterval); //remettre .bind(this)
    }
  }

  function useTransition() {
    if (transitionSteps.length === 0) {
      clearInterval(transtion);
      return;
    }
    value = Math.round( transitionSteps.shift()  as number);
    sendMessageToWebSocket(updateValueAndMakeMessage());
  };

  function getValueNewValue({ state, brightness }: { state?: SwitchState, brightness?: number | null }): number {
    if (state === payload.OFF) return 0;
    if (brightness === null)   brightness = 255;
    if (!brightness)           brightness = 0;
    if (max)                   brightness = Math.round((max * brightness) / 255);
    return brightness;
  }

  function updateValueAndMakeMessage() {
    dmxAddress && setDmx(dmxAddress, Math.round(value));
    return {
      context,
      domain        : haEntities.LIGHT,
      service       : haServices.UPDATE_ENTITY,
      "service_data": {
        brightness : value,
        "entity_id": haEntities.LIGHT + "." + deviceId
      }
    };
  }

  function updateAndPropagate(newValue: number, fromAgent=false) {

    if (newValue === value)          return;
    if (fromAgent && !isAgentDrived) return;
    value = newValue;
    sendMessageToWebSocket(updateValueAndMakeMessage());
  }

  function useAgent() {
    isAgentDrived = true;
  }

  return {
    get currentValue(){ return value; },
    updateAndPropagate,
    useAgent
  };
}