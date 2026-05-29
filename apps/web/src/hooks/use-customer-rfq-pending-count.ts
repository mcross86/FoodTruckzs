"use client";

import { useCallback, useEffect, useState } from "react";

import { useCustomerAuthSession } from "@/lib/auth-session";
import {
  countCustomerRfqPendingActions,
  fetchCustomerRfqs,
  hasUnsubmittedRfqDraft,
} from "@/lib/customer-rfq-actions";

export function useCustomerRfqPendingCount() {
  const session = useCustomerAuthSession();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const localDraftCount = hasUnsubmittedRfqDraft() ? 1 : 0;

    if (!session.accessToken.trim()) {
      setCount(localDraftCount);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const rfqs = await fetchCustomerRfqs(session.apiBaseUrl, session.accessToken);
      setCount(countCustomerRfqPendingActions(rfqs));
    } catch {
      setCount(localDraftCount);
    } finally {
      setIsLoading(false);
    }
  }, [session.accessToken, session.apiBaseUrl]);

  useEffect(() => {
    void refresh();

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh, session.user?.id]);

  return { count, isLoading, refresh };
}
