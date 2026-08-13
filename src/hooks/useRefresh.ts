import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/queryKeys";

export const useRefresh = () => {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const queryClient = useQueryClient();

  return async () => {
    if (!activeOrgId) return;

    const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours back

    const [{ data: convs }, { data: msgs }] = await Promise.all([
      supabase
        .from("conversations")
        .select()
        .eq("organization_id", activeOrgId)
        .gt("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(999),
      supabase
        .from("messages")
        .select()
        .eq("organization_id", activeOrgId)
        .gt("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(999),
    ]);

    // Read actions from the store at call time — no subscriptions needed.
    const { pushConversations, pushMessages } = useBoundStore.getState().chat;
    if (convs) pushConversations(convs);
    if (msgs) pushMessages(msgs);
    queryClient.invalidateQueries({
      queryKey: queryKeys.contacts.all(activeOrgId),
    });
  };
};
