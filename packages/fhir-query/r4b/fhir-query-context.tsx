import { FhirRestfulClient } from "@bonfhir/core/r4b";
import { QueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

export interface FhirQueryContext {
  /**
   * The {@link FhirRestfulClient} to make FHIR HTTP requests.
   */
  fhirClient: FhirRestfulClient;

  /**
   * The {@link QueryClient} used to manage the state.
   */
  queryClient: QueryClient;

  /**
   * `true` when the cache invalidation / optimizations are managed by the default hooks.
   */
  manageCache: boolean;
}

/**
 * The context used by fhir-query.
 */
export const FhirQueryContext = createContext<FhirQueryContext | undefined>(
  undefined
);

/**
 * Get the current {@link FhirQueryContext}.
 *
 * @throws Error if no parent context exists (a.k.a. no `FhirQueryProvider` was used in the parent tree).
 */
export const useFhirQueryContext = (): FhirQueryContext => {
  const context = useContext(FhirQueryContext);
  if (!context) {
    throw new Error(
      "Missing FhirQueryContext. Did you forget to use a parent FhirQueryProvider?"
    );
  }

  return context;
};
