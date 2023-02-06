import {
  bundleNavigator,
  BundleNavigator,
  ExtractResource,
  ExtractSearchBuilder,
  FhirRestfulClient,
  JSONPatchBody,
  resourceSearch,
  ResourceType,
} from "@bonfhir/core/r4b";
import {
  QueryClient,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { Bundle, CapabilityStatement, FhirResource } from "fhir/r4";
import _ from "lodash";
import { useCallback } from "react";
import { useFhirQueryContext } from "./fhir-query-context";

/**
 * Manages [Query keys](https://tanstack.com/query/latest/docs/react/guides/query-keys) and
 * cache optimizations / invalidations.
 */
export const FhirQueryKeys = {
  /**
   * Get the query keys for a read request
   */
  read: (
    type: ResourceType,
    id: string,
    options?: Parameters<FhirRestfulClient["read"]>[2] | null | undefined
  ) => [type, id, "read", options] as const,

  /**
   * Get the query keys for a vread request
   */
  vread: (
    type: ResourceType,
    id: string,
    vid: string,
    options?: Parameters<FhirRestfulClient["vread"]>[3] | null | undefined
  ) => [type, id, "vread", vid, options] as const,

  /**
   * Get the query keys for a history request
   */
  history: (
    type: ResourceType,
    id: string,
    options?: Parameters<FhirRestfulClient["history"]>[2] | null | undefined
  ) => [type, id, "history", options] as const,

  /**
   * Get the query keys for a search request
   */
  search: (
    type: ResourceType,
    parameters?: string | null | undefined,
    options?: Parameters<FhirRestfulClient["search"]>[2] | null | undefined
  ) => [type, "search", parameters, options] as const,

  /**
   * Lookup the query cache and try to find an existing instance of a resource stored in a search request,
   * by resource type and id.
   *
   * This enables an optimization to load initial data on read if it has been retrieved previously during a search
   * (a.k.a. master-detail scenarios)
   */
  findInSearch: (
    queryClient: QueryClient,
    type: ResourceType,
    id: string
  ): ExtractResource<ResourceType> | undefined => {
    return _(queryClient.getQueriesData([type, "search"]) || [])
      .flatMap(([, result]) =>
        (result as BundleResult<FhirResource>).nav.type(type)
      )
      .find((resource) => resource.id === id);
  },

  /**
   * Get the query keys for a capabilities request
   */
  capabilities: () => ["capabilities"] as const,

  /**
   * Get the query keys for an execute request
   */
  execute: (
    operation: string,
    type: ResourceType | null | undefined,
    id: string | null | undefined,
    parameters: unknown | null | undefined
  ) => [type, id, "execute", operation, parameters] as const,

  /**
   * Invalidate all queries that might be impacted by a change on a resource.
   */
  invalidateQueries: (
    queryClient: QueryClient,
    type: ResourceType,
    id: string
  ) => {
    queryClient.invalidateQueries([type, id]);
    queryClient.invalidateQueries([type, "search"]);
  },
};

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for a read request.
 *
 * @see https://hl7.org/fhir/http.html#read
 */
export function useFhirRead<TResource extends ResourceType>(
  type: TResource,
  id: string,
  options?:
    | {
        fhir?: Parameters<FhirRestfulClient["read"]>[2];
        query:
          | Omit<
              UseQueryOptions<
                ExtractResource<TResource> | undefined,
                unknown,
                ExtractResource<TResource> | undefined,
                ReturnType<typeof FhirQueryKeys["read"]>
              >,
              "initialData" | "queryKey" | "queryFn"
            >
          | null
          | undefined;
        throwIfNotFound?: boolean | null | undefined;
      }
    | null
    | undefined
): UseQueryResult<ExtractResource<TResource> | undefined> {
  const fhirQueryContext = useFhirQueryContext();

  const queryFn = useCallback(async () => {
    const resource = await fhirQueryContext.fhirClient.read(
      type,
      id,
      options?.fhir
    );
    if (!resource && options?.throwIfNotFound) {
      throw new Error(`${type} with id ${id} cannot be found.`);
    }

    return resource;
  }, [fhirQueryContext.fhirClient, type, id, options?.fhir]);

  return useQuery({
    initialData: () =>
      fhirQueryContext.manageCache
        ? FhirQueryKeys.findInSearch(fhirQueryContext.queryClient, type, id)
        : undefined,
    ...options?.query,
    queryKey: FhirQueryKeys.read(type, id, options?.fhir),
    queryFn,
  } as Omit<UseQueryOptions<ExtractResource<TResource> | undefined, unknown, ExtractResource<TResource> | undefined, ReturnType<typeof FhirQueryKeys["read"]>>, "initialData">);
}

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for a vread request.
 *
 * @see https://hl7.org/fhir/http.html#vread
 */
export function useFhirVRead<TResource extends ResourceType>(
  type: TResource,
  id: string,
  vid: string,
  options?:
    | {
        fhir?: Parameters<FhirRestfulClient["vread"]>[3];
        query:
          | Omit<
              UseQueryOptions<
                ExtractResource<TResource> | undefined,
                unknown,
                ExtractResource<TResource> | undefined,
                ReturnType<typeof FhirQueryKeys["vread"]>
              >,
              "initialData" | "queryKey" | "queryFn"
            >
          | null
          | undefined;
        throwIfNotFound?: boolean | null | undefined;
      }
    | null
    | undefined
): UseQueryResult<ExtractResource<TResource> | undefined> {
  const fhirQueryContext = useFhirQueryContext();

  const queryFn = useCallback(() => {
    const resource = fhirQueryContext.fhirClient.vread(
      type,
      id,
      vid,
      options?.fhir
    );
    if (!resource && options?.throwIfNotFound) {
      throw new Error(
        `${type} with id ${id} and version ${vid} cannot be found.`
      );
    }
    return resource;
  }, [fhirQueryContext.fhirClient, type, id, vid, options?.fhir]);

  return useQuery({
    ...options?.query,
    queryKey: FhirQueryKeys.vread(type, id, vid, options?.fhir),
    queryFn,
  });
}

export type BundleResult<
  PrimaryResourceType extends FhirResource,
  SecondaryResourceType extends FhirResource = PrimaryResourceType
> = {
  bundle: Bundle<PrimaryResourceType>;
  nav: BundleNavigator<PrimaryResourceType, SecondaryResourceType>;
};

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for a history request.
 *
 * @see https://hl7.org/fhir/http.html#history
 */
export function useFhirHistory<TResource extends ResourceType>(
  type: TResource,
  id: string,
  options?:
    | {
        fhir?: Parameters<FhirRestfulClient["history"]>[2];
        query:
          | Omit<
              UseQueryOptions<
                BundleResult<ExtractResource<TResource>>,
                unknown,
                BundleResult<ExtractResource<TResource>>,
                ReturnType<typeof FhirQueryKeys["history"]>
              >,
              "initialData" | "queryKey" | "queryFn"
            >
          | null
          | undefined;
      }
    | null
    | undefined
): UseQueryResult<BundleResult<ExtractResource<TResource>>> {
  const fhirQueryContext = useFhirQueryContext();

  const queryFn = useCallback(async (): Promise<
    BundleResult<ExtractResource<TResource>>
  > => {
    const bundle = await fhirQueryContext.fhirClient.history(
      type,
      id,
      options?.fhir
    );
    return {
      bundle,
      nav: bundleNavigator(bundle),
    };
  }, [fhirQueryContext.fhirClient, type, id, options?.fhir]);

  return useQuery({
    ...options?.query,
    queryKey: FhirQueryKeys.history(type, id, options?.fhir),
    queryFn,
  });
}

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for a search request.
 *
 * Returns both the actual `Bundle`, and a configured `BundleNavigator` to help with manipulating the bundle.
 *
 * @param parameters - the search parameters can either be:
 *  - a function that manipulates a `resourceSearch` for the primary resource type
 *  - a search parameters string
 *  - or an absolute URL that can be used to retrieve links in subsequent requests (a.k.a. handling pagination)
 *
 * @see https://hl7.org/fhir/http.html#search
 *
 * @example
 *
 *  const patientQuery = useFhirSearch("Patient", pageUrl || (search) => search.name("John Doe")._sort("-organization"));
 */
export function useFhirSearch<
  TResource extends ResourceType,
  SecondaryResourceType extends FhirResource = ExtractResource<TResource>
>(
  type: TResource,
  parameters?:
    | ((
        search: ExtractSearchBuilder<TResource>
      ) => ExtractSearchBuilder<TResource> | string)
    | string
    | null
    | undefined,
  options?:
    | {
        fhir?: Parameters<FhirRestfulClient["search"]>[2];
        query:
          | Omit<
              UseQueryOptions<
                BundleResult<ExtractResource<TResource>, SecondaryResourceType>,
                unknown,
                BundleResult<ExtractResource<TResource>, SecondaryResourceType>,
                ReturnType<typeof FhirQueryKeys["search"]>
              >,
              "initialData" | "queryKey" | "queryFn"
            >
          | null
          | undefined;
      }
    | null
    | undefined
): UseQueryResult<
  BundleResult<ExtractResource<TResource>, SecondaryResourceType>
> {
  const fhirQueryContext = useFhirQueryContext();

  const finalParameters =
    typeof parameters === "function"
      ? extractSearchBuilderAsString(parameters(resourceSearch(type)))
      : parameters;

  const queryFn = useCallback(async () => {
    if (
      finalParameters?.startsWith("http://") ||
      finalParameters?.startsWith("https://")
    ) {
      const bundle = await fhirQueryContext.fhirClient.get<
        Bundle<ExtractResource<TResource>>
      >(finalParameters);
      return {
        bundle,
        nav: bundleNavigator<ExtractResource<TResource>, SecondaryResourceType>(
          bundle
        ),
      };
    }

    const bundle = await fhirQueryContext.fhirClient.search(
      type,
      finalParameters,
      options?.fhir
    );

    return {
      bundle,
      nav: bundleNavigator<ExtractResource<TResource>, SecondaryResourceType>(
        bundle
      ),
    };
  }, [fhirQueryContext.fhirClient, type, finalParameters, options?.fhir]);

  return useQuery({
    ...options?.query,
    queryKey: FhirQueryKeys.search(type, finalParameters, options?.fhir),
    queryFn,
  });
}

function extractSearchBuilderAsString<TResourceType extends ResourceType>(
  search: ExtractSearchBuilder<TResourceType> | string
): string {
  if (typeof search === "string") {
    return search;
  }

  return search.href;
}

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for a capabilities request.
 *
 * @see https://hl7.org/fhir/http.html#capabilities
 */
export function useFhirCapabilities(
  mode?: "full" | "normative" | "terminology" | null | undefined,
  options?:
    | Omit<
        UseQueryOptions<
          CapabilityStatement,
          unknown,
          CapabilityStatement,
          ReturnType<typeof FhirQueryKeys["capabilities"]>
        >,
        "initialData" | "queryKey" | "queryFn"
      >
    | null
    | undefined
): UseQueryResult<CapabilityStatement> {
  const fhirQueryContext = useFhirQueryContext();

  const queryFn = useCallback(
    () => fhirQueryContext.fhirClient.capabilities(mode),
    [fhirQueryContext.fhirClient, mode]
  );

  return useQuery({
    ...options,
    queryKey: FhirQueryKeys.capabilities(),
    queryFn,
  });
}

/**
 * Return a [Query](https://tanstack.com/query/latest/docs/react/guides/queries) for an operation request.
 *
 * It is your responsibility to ensure that there is no side-effect to running this operation (as a query).
 * If there is, you should use the {@link useFhirExecuteMutation} hook instead.
 *
 * @see https://hl7.org/fhir/operations.html
 * @see https://www.hl7.org/fhir/operationslist.html
 */
export function useFhirExecute<
  TOperationResult,
  TOperationParameters = unknown
>(
  operation: string,
  operationOptions?:
    | {
        type?: ResourceType | null | undefined;
        id?: string | null | undefined;
        parameters?: TOperationParameters | null | undefined;
      }
    | null
    | undefined,
  queryOptions?:
    | Omit<
        UseQueryOptions<
          TOperationResult,
          unknown,
          TOperationResult,
          ReturnType<typeof FhirQueryKeys["execute"]>
        >,
        "initialData" | "queryKey" | "queryFn"
      >
    | null
    | undefined
): UseQueryResult<TOperationResult> {
  const fhirQueryContext = useFhirQueryContext();

  const queryFn = useCallback(
    () => fhirQueryContext.fhirClient.execute(operation, operationOptions),
    [
      fhirQueryContext.fhirClient,
      operation,
      operationOptions?.type,
      operationOptions?.id,
      operationOptions?.parameters,
    ]
  );

  return useQuery({
    ...queryOptions,
    queryKey: FhirQueryKeys.execute(
      operation,
      operationOptions?.type,
      operationOptions?.id,
      operationOptions?.parameters
    ),
    queryFn,
  } as Omit<UseQueryOptions<TOperationResult, unknown, TOperationResult, ReturnType<typeof FhirQueryKeys["execute"]>>, "initialData">);
}

export type UseFhirUpdateMutationArgs<TResource extends ResourceType> = {
  body: ExtractResource<TResource>;
  options?: Parameters<FhirRestfulClient["update"]>[1];
};

/**
 * Return a [Mutation](https://tanstack.com/query/latest/docs/react/guides/mutations) for an update request.
 *
 * @see https://hl7.org/fhir/http.html#update
 */
export function useFhirUpdateMutation<TResource extends ResourceType>(
  type: TResource,
  options?:
    | Omit<
        UseMutationOptions<
          ExtractResource<TResource>,
          unknown,
          UseFhirUpdateMutationArgs<TResource>,
          unknown
        >,
        "mutationFn"
      >
    | null
    | undefined
): UseMutationResult<
  ExtractResource<TResource>,
  unknown,
  UseFhirUpdateMutationArgs<TResource>,
  unknown
> {
  const fhirQueryContext = useFhirQueryContext();

  const mutationFn = useCallback(
    (
      args: UseFhirUpdateMutationArgs<TResource>
    ): Promise<ExtractResource<TResource>> => {
      return fhirQueryContext.fhirClient.update(args.body, args.options);
    },
    [fhirQueryContext.fhirClient, type]
  );

  return useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      if (fhirQueryContext.manageCache) {
        FhirQueryKeys.invalidateQueries(
          fhirQueryContext.queryClient,
          data.resourceType,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          data.id!
        );
        fhirQueryContext.queryClient.setQueryData(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          FhirQueryKeys.read(data.resourceType, data.id!),
          data
        );
      }
      options?.onSuccess?.(data, variables, context);
    },
    mutationFn,
  });
}

export type UseFhirPatchMutationArgs = {
  id: string;
  body: JSONPatchBody;
  options?: Parameters<FhirRestfulClient["patch"]>[3];
};

/**
 * Return a [Mutation](https://tanstack.com/query/latest/docs/react/guides/mutations) for a patch request.
 *
 * @see https://hl7.org/fhir/http.html#patch
 */
export function useFhirPatchMutation<TResource extends ResourceType>(
  type: TResource,
  options?:
    | Omit<
        UseMutationOptions<
          ExtractResource<TResource>,
          unknown,
          UseFhirPatchMutationArgs,
          unknown
        >,
        "mutationFn"
      >
    | null
    | undefined
): UseMutationResult<
  ExtractResource<TResource>,
  unknown,
  UseFhirPatchMutationArgs,
  unknown
> {
  const fhirQueryContext = useFhirQueryContext();

  const mutationFn = useCallback(
    (args: UseFhirPatchMutationArgs): Promise<ExtractResource<TResource>> => {
      return fhirQueryContext.fhirClient.patch(
        type,
        args.id,
        args.body,
        args.options
      );
    },
    [fhirQueryContext.fhirClient, type]
  );

  return useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      if (fhirQueryContext.manageCache) {
        FhirQueryKeys.invalidateQueries(
          fhirQueryContext.queryClient,
          data.resourceType,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          data.id!
        );
        fhirQueryContext.queryClient.setQueryData(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          FhirQueryKeys.read(data.resourceType, data.id!),
          data
        );
      }
      options?.onSuccess?.(data, variables, context);
    },
    mutationFn,
  });
}

export type UseFhirDeleteMutationArgs = {
  type: ResourceType;
  id: string;
  options?: Parameters<FhirRestfulClient["delete"]>[2];
};

/**
 * Return a [Mutation](https://tanstack.com/query/latest/docs/react/guides/mutations) for a delete request.
 *
 * @see https://hl7.org/fhir/http.html#delete
 */
export function useFhirDeleteMutation(
  options?:
    | UseMutationOptions<void, unknown, UseFhirDeleteMutationArgs, unknown>
    | null
    | undefined
): UseMutationResult<void, unknown, UseFhirDeleteMutationArgs, unknown> {
  const fhirQueryContext = useFhirQueryContext();

  const mutationFn = useCallback(
    (args: UseFhirDeleteMutationArgs): Promise<void> => {
      return fhirQueryContext.fhirClient.delete(
        args.type,
        args.id,
        args.options
      );
    },
    [fhirQueryContext.fhirClient]
  );

  return useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      if (fhirQueryContext.manageCache) {
        FhirQueryKeys.invalidateQueries(
          fhirQueryContext.queryClient,
          variables.type,
          variables.id
        );
      }
      options?.onSuccess?.(data, variables, context);
    },
    mutationFn,
  });
}

export type UseFhirCreateMutationArgs<TResource extends ResourceType> = {
  body: ExtractResource<TResource>;
  options?: Parameters<FhirRestfulClient["create"]>[1];
};

/**
 * Return a [Mutation](https://tanstack.com/query/latest/docs/react/guides/mutations) for a create request.
 *
 * @see https://hl7.org/fhir/http.html#create
 */
export function useFhirCreateMutation<TResource extends ResourceType>(
  type: TResource,
  options?:
    | Omit<
        UseMutationOptions<
          ExtractResource<TResource>,
          unknown,
          UseFhirCreateMutationArgs<TResource>,
          unknown
        >,
        "mutationFn"
      >
    | null
    | undefined
): UseMutationResult<
  ExtractResource<TResource>,
  unknown,
  UseFhirCreateMutationArgs<TResource>,
  unknown
> {
  const fhirQueryContext = useFhirQueryContext();

  const mutationFn = useCallback(
    (
      args: UseFhirCreateMutationArgs<TResource>
    ): Promise<ExtractResource<TResource>> => {
      return fhirQueryContext.fhirClient.create(args.body, args.options);
    },
    [fhirQueryContext.fhirClient, type]
  );

  return useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      if (fhirQueryContext.manageCache) {
        FhirQueryKeys.invalidateQueries(
          fhirQueryContext.queryClient,
          data.resourceType,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          data.id!
        );
        fhirQueryContext.queryClient.setQueryData(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          FhirQueryKeys.read(data.resourceType, data.id!),
          data
        );
      }
      options?.onSuccess?.(data, variables, context);
    },
    mutationFn,
  });
}

export type UseFhirExecuteMutationArgs<TOperationParameters = unknown> = {
  operation: string | null | undefined;
  options?:
    | {
        type?: ResourceType | null | undefined;
        id?: string | null | undefined;
        parameters?: TOperationParameters | null | undefined;
      }
    | null
    | undefined;
};

/**
 * Return a [Mutation](https://tanstack.com/query/latest/docs/react/guides/mutations) for an operation request.
 *
 * This version is to be used when the operation induces a side-effect, or you want to avoid query caching.
 * If that's not the case, consider using the {@link useFhirExecute} hook instead.
 *
 * @see https://hl7.org/fhir/operations.html
 * @see https://www.hl7.org/fhir/operationslist.html
 */
export function useFhirExecuteMutation<
  TOperationResult,
  TOperationParameters = unknown
>(
  options?:
    | Omit<
        UseMutationOptions<
          TOperationResult,
          unknown,
          UseFhirExecuteMutationArgs<TOperationParameters>,
          unknown
        >,
        "mutationFn"
      >
    | null
    | undefined
): UseMutationResult<
  TOperationResult,
  unknown,
  UseFhirExecuteMutationArgs<TOperationParameters>,
  unknown
> {
  const fhirQueryContext = useFhirQueryContext();

  const mutationFn = useCallback(
    (
      args: UseFhirExecuteMutationArgs<TOperationParameters>
    ): Promise<TOperationResult> => {
      return fhirQueryContext.fhirClient.execute(args.operation, args.options);
    },
    [fhirQueryContext.fhirClient]
  );

  return useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      if (
        fhirQueryContext.manageCache &&
        variables.options?.type &&
        variables.options?.id
      ) {
        FhirQueryKeys.invalidateQueries(
          fhirQueryContext.queryClient,
          variables.options.type,
          variables.options.id
        );
      }
      options?.onSuccess?.(data, variables, context);
    },
    mutationFn,
  });
}