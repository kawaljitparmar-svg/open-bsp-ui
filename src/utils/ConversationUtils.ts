export const updateConvExtra = async (
  conversation: ConversationRow,
  extra: {
    pinned?: string | null;
    archived?: string | null;
    paused?: string | null;
  },
) => {
  const merged: Record<string, string> = { ...(conversation.extra as Record<string, string> || {}) };
  
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }

  const { error } = await supabase
    .from("conversations")
    .update({ extra: merged })
    .eq("id", conversation.id);

  if (error) throw error;
};
