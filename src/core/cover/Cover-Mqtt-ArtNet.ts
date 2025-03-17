import      { convertFromPercent, convertToPercent } from "src/utils/stateAdapter";
import      { publish, subscribe, unsubscribe }      from "@infra/mqtt/mqtt";
import      { Device }                               from "../device/Device";
import type { DeviceArguments }                      from "../device/Device";
import      { haEntities }                           from "../entities";
import      { payload }                              from "@core/ha.constants";
import      { setDmx }                               from "@infra/artnet/artnet";

interface CoverArguments extends DeviceArguments {
  dmxActive     : number
  dmxDirection  : number
  movingDuration: number
}

const  loopSpeed                = 500;      //duration in ms
const  overMovingForCalibration = 2000;     //duration in ms

export class CoverMqttArtNet extends Device{
  private readonly baseTopic      : string;
  private readonly dmxActive      : number;
  private readonly dmxDirection   : number;
  private          isMoving      ?: NodeJS.Timer;
  private readonly movingDuration : number;            // duration in ms
  private          stateCode       = 0;                // 0: stopped 1: closing, 1: opening
  private readonly stateStrings    = [payload.STOPPED, payload.CLOSING, payload.OPENING, payload.CLOSED, payload.OPEN];
  private readonly setPositionSlug = "/set-position";
  private          timeoutForCalibration?: NodeJS.Timer;
  private          transition = {
    startMoment: 0,
    startValue : 0,
    target     : 0
  };

  constructor( name: string, args:object ) {
    super(deviceId);

    const { dmxActive, dmxDirection, movingDuration } = args as CoverArguments;
    this.baseTopic      = "homeassistant/"+haEntities.COVER+"/"+this.name;
    this.dmxActive      = dmxActive;
    this.dmxDirection   = dmxDirection;
    this.movingDuration = movingDuration;
    this.stateCode      = 0;

    subscribe(this.baseTopic,                      (message:string) => {this.setInitialPosition(message);});
    subscribe(this.baseTopic+"/command",           (message:string) => {this.command(message);});
    subscribe(this.baseTopic+this.setPositionSlug, (message:string) => {this.command(message);});
  }

  /**
   * Calculate the current position of the cover during a transition.
   *
   * @return {number} The current position of the cover.
   */
  private calculatePosition() {
    const direction = this.stateCode === 2 ? -255 : 255;
    return Math.round((direction/ this.movingDuration) * (Date.now() - this.transition.startMoment)) + this.transition.startValue;
  }

  /**
   * Start closing the cover.
   * If the cover is already moving, it will be stopped first.
   * Then the DMX values will be set to make the cover start closing.
   * The cover will be reported as "closing" to Home Assistant.
   *
   * @param {number} [value] - The value to set the cover to.
   *
   * @return {void}
   */
  private closing(value?:number) {
    this.isMoving && this.stop();
    this.sendToDMX(true, false);
    this.startMoving(value ?? 255);
    this.sendState(1);
  }

  /**
   * Execute a command on the cover.
   * Will stop any current movement, and then execute the command.
   *
   * @param {string|number} msg - The command to execute.
   * If a string, it will be either "close", "open", or "stop".
   * If a number, it is the position to set the cover to.
   *
   * @return {void}
   */
  public command(msg: string) {
    switch (msg) {
      case payload.CLOSE:
        this.value < 255 && this.closing(255);
        break;
      case payload.OPEN:
        this.value > 0 && this.opening(0);
        break;
      case payload.STOP:
        this.isMoving && this.stop();
        break;
      // case "":
      //   console.log(" !!!! CLEARED");
      //   // cleared topic
      //   break;
      default: { //number
        // publish(this.baseTopic, ""); //clear topic
        const position = convertFromPercent(parseInt(msg));
        if (position === this.value) return;
        position > this.value
          ? this.closing(position)
          : this.opening(position);
        break;
      }
    }
  }

  /**
   * Moves the cover to its moving target.
   * If the cover is already at the target, it will be stopped.
   * If the cover is too far, it will be stopped.
   * Otherwise, it will set the cover to its new position and send the new state to Home Assistant.
   *
   * @return {void}
   */
  private loopMoving() {
    const position = this.calculatePosition();

    // has acheived
    if (this.value === position) return this.stop();

    this.setValue(position);

    // is too far
    if ((this.stateCode === 1 && position >= this.transition.target) || (this.stateCode === 2 && position <= this.transition.target)) {
      if (this.transition.target === 0 || this.transition.target === 255) {
        this.stopInterval();
        this.timeoutForCalibration = setTimeout(this.stop.bind(this), overMovingForCalibration);
      }
      else this.stop();
    }

    this.sendPosition();
  }

  /**
   * Start opening the cover.
   * If the cover is already moving, it will be stopped first.
   * Then the DMX values will be set to make the cover start opening.
   * The cover will be reported as "opening" to Home Assistant.
   *
   * @param {number} [value] - The value to set the cover to.
   *
   * @return {void}
   */
  private opening(value?:number) {
    this.isMoving && this.stop();
    this.sendToDMX(true, true);
    this.startMoving(value ?? 0);
    this.sendState(2);
  }

  /**
   * Publishes the current cover position to Home Assistant over MQTT.
   * The position is converted to a percentage and published to the state topic.
   *
   * @return {void}
   */
  private sendPosition() {
    publish(this.baseTopic, convertToPercent(this.value), true);
  }

  private setInitialPosition(value:string) {
    this.setValue(parseInt(value));
    unsubscribe(this.baseTopic);
  }

  /**
   * Publishes the current cover state to Home Assistant over MQTT.
   * The state is determined by the {stateCode} parameter.
   * If the state is "closing" or "opening", and the cover is at the end of its range
   * (i.e. the value is 0 or 255), the state is converted to "closed" or "open".
   * The state is published to the state topic.
   *
   * @param {number} stateCode - The state of the cover, one of:
   *   0: stopped
   *   1: closing
   *   2: opening
   *
   * @return {void}
   */
  private sendState(stateCode:number) {
    if ((stateCode === 1 && this.value === 255) || (stateCode === 2 && this.value === 0)) {
      stateCode += 2;
    }
    publish(this.baseTopic+"/state", this.stateStrings[stateCode], true);
  }

  /**
   * Sets the DMX channels for the cover's activity and direction.
   * @param {boolean} isActive  - Whether the cover is active.
   * @param {boolean} isOpening - Whether the cover is opening.
   *
   * @return {void}
   */
  private sendToDMX(isActive:boolean, isOpening:boolean) {
    setDmx(this.dmxActive, isActive ? 255 : 0);
    setDmx(this.dmxDirection, isOpening ? 255 : 0);
  }

  /**
   * Starts moving the cover towards the target position.
   * @param {number} target - The target position to move towards.
   *
   * @return {void}
   */
  private startMoving( target:number ) {
    this.transition = {
      startMoment: Date.now(),
      startValue : this.value,
      target
    };
    this.isMoving = setInterval(this.loopMoving.bind(this), loopSpeed);
  }

  /**
   * Stop the cover.
   * If the cover is currently moving, it will be stopped immediately.
   * The cover will be reported as "stopped" to Home Assistant.
   *
   * @return {void}
   */
  private stop() {
    this.isMoving && this.stopInterval();
    this.timeoutForCalibration && this.stopTimeout();
    this.sendToDMX(false, false);
    this.sendState(this.stateCode);
    this.stateCode = 0;
  }

  /**
   * Stops the interval used to move the cover.
   * If the cover was moving, it will be stopped immediately.
   * The cover's value will be clamped to the range [0, 255].
   * The cover's position will be sent to Home Assistant.
   *
   * @return {void}
   */
  private stopInterval() {
    clearInterval(this.isMoving);
    this.isMoving = undefined;
    this.value < 0 && this.setValue(0);
    this.value > 255 && this.setValue(255);
    this.sendPosition();
  }

  /**
   * Stops the timeout for calibration.
   * If the cover is currently stopping, but it will be calibrated (i.e. the timeout is set), it will be stopped immediately.
   * The timeout will be cleared and the cover will be reported as "stopped" to Home Assistant.
   *
   * @return {void}
   */
  private stopTimeout() {
    clearTimeout(this.timeoutForCalibration);
    this.timeoutForCalibration = undefined;
  }
}