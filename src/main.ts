import { getEntity, importEntities, registerEntity } from "@core/entities";
import { haEntities }                                from "@core/ha.constants";
import { lightWsArtNetCustom }                       from "@core/light/light-Ws-ArtNet-Custom";
import { lightWsTemplate }                           from "@core/light/lightHaConfigTemplate";
import { registerAgent }                             from "@core/agents";
import { switchWsArtNet }                            from "@core/switch/Switch-Ws-ArNet";
import { switchWsTemplate }                          from "@core/switch/switchHaConfigTemplate";

const generateConfig = process.argv.includes("generate-ha-files");

(async () => {
  registerEntity("LIGHT_WS_ARTNET", lightWsArtNetCustom, lightWsTemplate); //TODO remmtre la version non custom pour la publication
  registerEntity("SWITCH_WS_ARNET", switchWsArtNet, switchWsTemplate);

  await importEntities(generateConfig);

  registerAgent({}, generateConfig); //TODO mettre la configuration dans des fichiers et faitre un systeme pour aller chercher les fichiers de conf des agents
  console.log(getEntity(haEntities.SWITCH, "cellier_relais_puissance_eclairage"));
})();
