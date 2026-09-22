import { loadPlayerName as load, playerKey as key, savePlayerName as save } from '@yujun/game-net'

/** Storage prefix and MQTT topic namespace for this game. */
export const APP = 'gostop'

export const playerKey = (): string => key(APP)
export const loadPlayerName = (): string => load(APP)
export const savePlayerName = (name: string): void => save(APP, name)
