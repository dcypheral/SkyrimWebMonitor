import type { EquippedHand } from '@/shared/lib/types';

// ============================================================================
// Shared Types (from protocol.ts)
// ============================================================================

export type CommandType =
  | 'equip'
  | 'unequip'
  | 'use'
  | 'drop'
  | 'favorite'
  | 'equip_spell'
  | 'unequip_spell'
  | 'favorite_spell'
  | 'equip_shout'
  | 'unequip_shout'
  | 'equip_power'
  | 'favorite_shout'
  | 'hotkey_set'
  | 'hotkey_clear'
  | 'hotkey_trigger'
  | 'quest_set_active'
  | 'player_marker_set'
  | 'player_marker_clear'
  | 'fast_travel'
  | 'read_book'
  | 'file_download'
  | 'texture_preview'
  | 'screenshot_take'
  | 'screenshot_list'
  | 'screenshot_get'
  | 'local_map_get'
  | 'perf_reset';

export type EquipHand = EquippedHand;

export type HotkeySlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// ============================================================================
// Client → Server Messages
// ============================================================================

interface BaseMessage {
  type: string;
}

export interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  id: string;
  settings?: {
    frequency?: number;
    sendOnChange?: boolean;
  };
  fields: Record<string, string>;
}

export interface UnsubscribeMessage extends BaseMessage {
  type: 'unsubscribe';
  id?: string;
}

export interface QueryMessage extends BaseMessage {
  type: 'query';
  id: string;
  fields: Record<string, string>;
}

export interface UnsubscribeAllMessage extends BaseMessage {
  type: 'unsubscribe_all';
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  id: string;
  command: CommandType;
  formId?: string;
  hand?: EquipHand;
  count?: number;
  slot?: HotkeySlot;
  active?: boolean;
  x?: number;
  y?: number;
  z?: number;
  path?: string;
  maxSize?: number;
}

export interface SendCommandOptions {
  command: CommandType;
  formId?: string;
  active?: boolean;
  hand?: EquipHand;
  count?: number;
  slot?: HotkeySlot;
  x?: number;
  y?: number;
  z?: number;
  path?: string;
  /** texture_preview / screenshot_get: cap the longest side of the returned image. */
  maxSize?: number;
  /** screenshot_get: file name from screenshot_list. */
  name?: string;
  /** screenshot_list: maximum number of files. */
  limit?: number;
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | UnsubscribeAllMessage
  | QueryMessage
  | HeartbeatMessage
  | CommandMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface DataMessage extends BaseMessage {
  type: 'data';
  id: string;
  ts: number;
  fields: Record<string, unknown>;
}

export interface HeartbeatResponseMessage extends BaseMessage {
  type: 'heartbeat';
  ts: number;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export interface FileDownloadResultData {
  mimeType: string;
  size: number;
  dataBase64: string;
}

export interface TexturePreviewResultData {
  mimeType: string;
  width: number;
  height: number;
  imageBase64: string;
}

export interface ScreenshotTakeResultData {
  queued: boolean;
}

export interface ScreenshotFileInfo {
  name: string;
  size: number;
  /** Unix seconds. */
  modified: number;
}

export interface ScreenshotListResultData {
  directory: string;
  baseName: string;
  total: number;
  files: ScreenshotFileInfo[];
}

export interface ScreenshotGetResultData {
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  size: number;
  dataBase64: string;
}

export interface LocalMapDoor {
  x: number;
  y: number;
  z: number;
  /** Where the door leads. */
  name: string;
}

/** local_map_get: navmesh floor plan (see plugin PROTOCOL.md). */
export interface LocalMapResultData {
  key: string;
  isInterior: boolean;
  name: string;
  cellFormId: string;
  worldspace: string | null;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  vertexCount: number;
  triangleCount: number;
  truncated: boolean;
  /** base64 Int32 LE x,y,z */
  vertices: string;
  /** base64 Uint32 LE a,b,c */
  triangles: string;
  /** base64 Uint8, open-edge bits per triangle */
  edges: string;
  doors: LocalMapDoor[];
}

export interface CommandResultMessage extends BaseMessage {
  type: 'commandResult';
  id: string;
  success: boolean;
  error?: string;
  data?:
    | FileDownloadResultData
    | TexturePreviewResultData
    | ScreenshotTakeResultData
    | ScreenshotListResultData
    | ScreenshotGetResultData
    | LocalMapResultData;
}

export type ServerMessage =
  | DataMessage
  | HeartbeatResponseMessage
  | ErrorMessage
  | CommandResultMessage;

// ============================================================================
// WebSocket client types (from types.ts)
// ============================================================================

export type MessageHandler = (_message: ServerMessage) => void;

export type EventCallback = (_data?: unknown) => void;

export interface RegistrationCleanup {
  (): void;
}