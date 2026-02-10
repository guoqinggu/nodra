/**
 * Nodra Framework
 * A metadata-driven web framework inspired by Frappe
 */

export const VERSION = '0.1.0';

// Application
export { Nodra } from './nodra.js';

// Document
export { Document } from './core/document/document.js';

// Errors
export {
  NodraError,
  ValidationError,
  MandatoryError,
  LinkValidationError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  DuplicateError,
  InvalidStateError,
  DatabaseError,
  AppError,
} from './core/errors.js';

// Types
export type {
  DocTypeDefinition,
  FieldDefinition,
  PermissionRule,
  NamingRule,
} from './core/doctype/schema.js';

export type { NodraConfig } from './core/config.js';

// Events
export {
  EventEmitter,
  EVENT_PRIORITY_VALUES,
} from './events/index.js';

export type {
  EventType,
  BaseEvent,
  EventHandler,
  EventPriority,
  DocumentEvent,
  UserEvent,
  SystemEvent,
} from './events/index.js';

// Hooks
export { HookRegistryManager } from './hooks/index.js';

export type {
  HooksConfig,
  DocEventsConfig,
  SchedulerEventsConfig,
  HookContext,
  DocHookHandler,
  BootHookHandler,
  ScheduledHookHandler,
  MethodOverrideHandler,
} from './hooks/index.js';

// Workflow
export {
  WorkflowManager,
  WorkflowValidationError,
  WorkflowExecutor,
  WorkflowExecutionError,
} from './workflow/index.js';

export type {
  WorkflowState,
  WorkflowTransition,
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowRegistry,
} from './workflow/index.js';

// Background Jobs
export {
  PostgresJobQueue,
  JobQueueError,
  JobScheduler,
  JobWorker,
  CronParser,
  CronParseError,
  parseCronExpression,
  isCronTimeMatch,
  JOB_PRIORITY_VALUES,
} from './jobs/index.js';

export type {
  Job,
  JobStatus,
  JobPriority,
  JobHandler,
  JobQueue,
  JobQueueConfig,
  ScheduledJob,
  WorkerConfig,
  CronSchedule,
} from './jobs/index.js';

// Real-time WebSocket
export {
  WebSocketServer,
  DefaultRoomManager,
  DocumentEventBroadcaster,
  getRoomKey,
  parseRoomKey,
} from './realtime/index.js';

export type {
  MessageType,
  ClientMessage,
  ServerMessage,
  RoomType,
  Room,
  ConnectedClient,
  WebSocketConfig,
  DocEvent,
  RoomManager,
  WebSocketServer as IWebSocketServer,
} from './realtime/index.js';

// File Management
export {
  LocalFileStorage,
  FileValidator,
  FileValidationError,
  sanitizeFilename,
  getFileExtension,
  formatFileSize,
  getMimeTypeFromExtension,
} from './files/index.js';

export type {
  FileStorage,
  FileUpload,
  FileMetadata,
  FileValidationConfig,
  FileStorageConfig,
  FileAttachment,
} from './files/index.js';

// Reporting
export {
  QueryReportExecutor,
  ScriptReportExecutor,
  ReportExecutor,
  DefaultReportRegistry,
  formatColumnValue,
  createColumnFormatter,
  formatRow,
  formatRows,
} from './reports/index.js';

export type {
  ReportType,
  ColumnType,
  ReportColumn,
  ReportFilter,
  QueryReportDefinition,
  ScriptReportDefinition,
  ReportDefinition,
  ReportContext,
  ReportRow,
  ReportResult,
  ScriptReportFunction,
  ReportExecutor as IReportExecutor,
  ReportRegistry,
  ColumnFormatter,
  ExportFormat,
} from './reports/index.js';

// CLI
export {
  NewSiteCommand,
  MigrateCommand,
  StartCommand,
  ConsoleCommand,
} from './cli/index.js';

export type {
  Command,
  CLIOptions,
  NewSiteOptions,
  MigrateOptions,
  StartOptions,
  ConsoleOptions,
} from './cli/index.js';

// Apps
export {
  DefaultAppLoader,
  DefaultAppRegistry,
  DefaultAppInstaller,
  DependencyResolver,
} from './apps/index.js';

export type {
  AppManifest,
  App,
  InstallOptions,
  UninstallOptions,
  AppLoader,
  AppInstaller,
  AppRegistry,
  DependencyResolution,
} from './apps/index.js';
