export type LightDimmerAgentArguments = {
  inputSelectEntity: string
  presets          : {[presetName: string]: {[entity: string]: number}}
  targets          : string[]
}