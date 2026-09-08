/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminRecovery from "../adminRecovery.js";
import type * as attendance from "../attendance.js";
import type * as leaves from "../leaves.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as settings from "../settings.js";
import type * as setup from "../setup.js";
import type * as students from "../students.js";
import type * as superAdmin from "../superAdmin.js";
import type * as tardiness from "../tardiness.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminRecovery: typeof adminRecovery;
  attendance: typeof attendance;
  leaves: typeof leaves;
  maintenance: typeof maintenance;
  messages: typeof messages;
  settings: typeof settings;
  setup: typeof setup;
  students: typeof students;
  superAdmin: typeof superAdmin;
  tardiness: typeof tardiness;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
