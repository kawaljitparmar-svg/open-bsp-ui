import {
  type ConversationRow,
  type MessageRow,
  supabase,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/queryKeys";

export const useRealtimeSubscription = () => {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  const pushConversations = useBoundStore(
    (state) => state.chat.pushConversations,
  );
  const pushMessages = useBoundStore((state) => state.chat.pushMessages);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activeOrgId) return;

    const filter = `organization_id=eq.${activeOrgId}`;

    const channel = supabase
      .channel("rialtaim")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter,
        },
        (payload) => {
          // TODO: https://github.com/supabase/supabase/issues/32817
          if (payload.table !== "conversations") return;
          console.log("[Realtime] conversations:", payload.eventType);

          const conversation = payload.new as ConversationRow;

          pushConversations([conversation]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter,
        },
        (payload) => {
          // TODO: https://github.com/supabase/supabase/issues/32817
          if (payload.table !== "messages") return;
          console.log("[Realtime] messages:", payload.eventType, (payload.new as MessageRow)?.id);

          const message = payload.new as MessageRow;

          pushMessages([message]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
          filter,
        },
        (payload) => {
          console.log("[Realtime] contacts:", payload.eventType);
          // A contact was created, renamed, or deleted. Invalidate all contact
          // and contacts_addresses queries so the conversation list display names
          // and the contacts page both reflect the change immediately.
          queryClient.invalidateQueries({
            queryKey: queryKeys.contacts.all(activeOrgId),
          });
          queryClient.invalidateQueries({
            queryKey: [activeOrgId, "contacts_addresses"],
          });
        },
      );

    channel.subscribe((status, err) => {
      console.log("[Realtime] status:", status);
      if (err) console.error("[Realtime] error:", err);
    });

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [activeOrgId]);
};
