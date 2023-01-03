import { Bundle, CapabilityStatement, FhirResource } from "fhir/r4";
import { ExtractResource, ResourceType } from "./types";

/**
 * Abstract FHIR Restful Client that can be used as a dependency.
 * Concrete implementation can be built following the interface defined here.
 *
 * https://hl7.org/fhir/http.html
 */
export interface FhirRestfulClient {
  /**
   * The read interaction accesses the current contents of a resource.
   * https://hl7.org/fhir/http.html#read
   */
  read: <TResource extends ResourceType>(
    type: TResource,
    id: string,
    options?: GeneralParameters | null | undefined
  ) => Promise<ExtractResource<TResource> | undefined>;

  /**
   * The vread interaction performs a version specific read of the resource.
   * https://hl7.org/fhir/http.html#vread
   */
  vread: <TResource extends ResourceType>(
    type: TResource,
    id: string,
    vid: string,
    options?: GeneralParameters | null | undefined
  ) => Promise<ExtractResource<TResource> | undefined>;

  /**
   * The update interaction creates a new current version for an existing resource or creates an initial version
   * if no resource already exists for the given id.
   * https://hl7.org/fhir/http.html#update
   */
  update: <TResource extends FhirResource>(
    body: TResource,
    options?:
      | (GeneralParameters &
          ConcurrencyParameters &
          ConditionalSearchParameters)
      | null
      | undefined
  ) => Promise<TResource>;

  /**
   * As an alternative to updating an entire resource, clients can perform a patch operation.
   * https://hl7.org/fhir/http.html#patch
   */
  patch: <TResource extends ResourceType>(
    type: TResource,
    id: string,
    body: JSONPatchBody,
    options?:
      | (GeneralParameters &
          ConcurrencyParameters &
          ConditionalSearchParameters)
      | null
      | undefined
  ) => Promise<ExtractResource<TResource>>;

  /**
   * The delete interaction removes an existing resource.
   * https://hl7.org/fhir/http.html#delete
   */
  delete: (
    type: ResourceType,
    id: string,
    options?:
      | (GeneralParameters & ConditionalSearchParameters)
      | null
      | undefined
  ) => Promise<void>;

  /**
   * The history interaction retrieves the history of either a particular resource, all resources of a given type, or all resources supported by the system.
   * https://hl7.org/fhir/http.html#history
   */
  history: <TResource extends ResourceType>(
    type?: TResource | null | undefined,
    id?: string | null | undefined,
    options?: (GeneralParameters & HistoryParameters) | null | undefined
  ) => Promise<Bundle<ExtractResource<TResource>>>;

  /**
   * The create interaction creates a new resource in a server-assigned location.
   * https://hl7.org/fhir/http.html#create
   */
  create: <TResource extends FhirResource>(
    body: TResource,
    options?:
      | (GeneralParameters & ConditionalSearchParameters)
      | null
      | undefined
  ) => Promise<TResource>;

  /**
   * This interaction searches a set of resources based on some filter criteria.
   * https://hl7.org/fhir/http.html#search
   */
  search: <TResource extends ResourceType>(
    type?: TResource | null | undefined,
    parameters?: string | null | undefined,
    options?: GeneralParameters | null | undefined
  ) => Promise<Bundle<ExtractResource<TResource>>>;

  /**
   * The capabilities interaction retrieves the information about a server's capabilities - which portions of this specification it supports.
   * https://hl7.org/fhir/http.html#capabilities
   */
  capabilities: (
    mode?: "full" | "normative" | "terminology" | null | undefined
  ) => Promise<CapabilityStatement>;

  /**
   * The batch and transaction interactions submit a set of actions to perform on a server in a single HTTP request/response.
   * https://hl7.org/fhir/http.html#transaction
   */
  batch: (
    body: Bundle,
    options?: GeneralParameters | null | undefined
  ) => Promise<Bundle>;

  /**
   * Execute a server operation.
   * https://www.hl7.org/fhir/operations.html
   * https://www.hl7.org/fhir/operationslist.html
   */
  execute: <TOperationResult, TOperationParameters = unknown>(
    operation: string | null | undefined,
    options?:
      | {
          type?: ResourceType | null | undefined;
          id?: string | null | undefined;
          parameters?: TOperationParameters | null | undefined;
        }
      | null
      | undefined
  ) => Promise<TOperationResult>;
}

/**
 * https://hl7.org/fhir/http.html#parameters
 */
export interface GeneralParameters {
  /**
   * https://hl7.org/fhir/http.html#parameters
   */
  _format?: string | null | undefined;

  /**
   * https://hl7.org/fhir/http.html#parameters
   */
  _pretty?: boolean | null | undefined;

  /**
   * https://hl7.org/fhir/search.html#summary
   */
  _summary?: "true" | "text" | "data" | "count" | "false" | null | undefined;

  /**
   * https://hl7.org/fhir/search.html#elements
   */
  _elements?: string | Array<string> | null | undefined;
}

/**
 * https://hl7.org/fhir/http.html#concurrency
 */
export interface ConcurrencyParameters {
  /**
   * https://hl7.org/fhir/http.html#concurrency
   */
  preventConcurrentUpdates?: boolean | null | undefined;
}

/**
 * https://hl7.org/fhir/http.html#cond-update
 */
export type ConditionalSearchParameters = Record<string, string>;

/**
 * https://hl7.org/fhir/http.html#history
 */
export interface HistoryParameters {
  /**
   * https://hl7.org/fhir/http.html#history
   */
  _count?: number | null | undefined;

  /**
   * https://hl7.org/fhir/http.html#history
   */
  _since?: Date | string | null | undefined;

  /**
   * https://hl7.org/fhir/http.html#history
   */
  _at?: Date | string | null | undefined;

  /**
   * https://hl7.org/fhir/http.html#history
   */
  _list?: string | null | undefined;
}

export type JSONPatchBody = Array<JSONPatchOperation>;

export type JSONPatchOperation =
  | JSONPatchOperationAdd
  | JSONPatchOperationRemove
  | JSONPatchOperationReplace
  | JSONPatchOperationMove
  | JSONPatchOperationCopy
  | JSONPatchOperationTest;

export interface JSONPatchOperationAdd {
  op: "add";
  path: string;
  value: unknown;
}

export interface JSONPatchOperationRemove {
  op: "remove";
  path: string;
}

export interface JSONPatchOperationReplace {
  op: "replace";
  path: string;
  value: unknown;
}

export interface JSONPatchOperationMove {
  op: "move";
  path: string;
  from: string;
}

export interface JSONPatchOperationCopy {
  op: "copy";
  path: string;
  from: string;
}

export interface JSONPatchOperationTest {
  op: "test";
  path: string;
  value: unknown;
}