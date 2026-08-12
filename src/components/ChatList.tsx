import { useRef, useState } from "react";
import useBoundStore from "@/stores/useBoundStore";
import ChatListItem from "./ChatListItem";
import { type ConversationRow, type MessageRow } from "@/supabase/client";
import { timestampDescending } from "@/stores/chatSlice";
import { filters, Filters } from "@/stores/uiSlice";
import Fuse from "fuse.js";
import { useTranslation } from "@/hooks/useTranslation";
import Spinner from "./Spinner";
import { useRefresh } from "@/hooks/useRefresh";

export type ConvMetadata = {
  convId: string;
  conv: ConversationRow;
  mostRecentMsg?: MessageRow;
};

function pinnedAscending(a: ConversationRow, b: ConversationRow) {
  const aPin = a.extra?.pinned;
  const bPin = b.extra?.pinned;

  if (!aPin && !bPin) {
    return 0;
  }

  if (aPin && bPin) {
    return +new Date(aPin) > +new Date(bPin) ? 1 : -1;
  }

  return aPin && !bPin ? -1 : 1;
}

const PULL_THRESHOLD = 65;
const MAX_PULL = 90;

const ChatList = () => {
  const { translate: t } = useTranslation();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const conversations = useBoundStore((state) => state.chat.conversations);
  const messages = useBoundStore((state) => state.chat.messages);
  const filterName = useBoundStore((state) => state.ui.filter);
  const setFilterName = useBoundStore((state) => state.ui.setFilter);
  const searchPattern = useBoundStore((state) => state.ui.searchPattern);
  const setSearchPattern = useBoundStore((state) => state.ui.setSearchPattern);

  const refresh = useRefresh();
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 1) === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartY.current || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.5, MAX_PULL));
    } else if (delta < -5) {
      // user started scrolling up — cancel pull gesture
      touchStartY.current = 0;
      setPullY(0);
    }
  };

  const onTouchEnd = async () => {
    if (!touchStartY.current) return;
    const triggered = pullY >= PULL_THRESHOLD;
    touchStartY.current = 0;
    setPullY(0);

    if (triggered) {
      setIsRefreshing(true);
      await refresh();
      setIsRefreshing(false);
    }
  };

  const indicatorHeight = isRefreshing ? 56 : pullY;
  const showSpinner = isRefreshing || pullY >= PULL_THRESHOLD;

  function getMostRecentMsg(convId: string): MessageRow | undefined {
    return messages.get(convId)?.values().next().value;
  }

  let items: ConvMetadata[] = [...conversations]
    .map(([convId, conv]) => ({
      convId,
      conv,
      mostRecentMsg: getMostRecentMsg(convId),
    }))
    .filter(
      (a) =>
        a.conv.organization_id === activeOrgId &&
        filters[filterName](a.conv, a.mostRecentMsg) &&
        !!a.mostRecentMsg,
    );

  if (searchPattern) {
    const fuse = new Fuse(items, {
      threshold: 0.4,
      keys: ["conv.name", "conv.contact_address"],
    });
    items = fuse.search(searchPattern).map((r) => r.item);
  } else {
    items.sort(
      (a, b) =>
        pinnedAscending(a.conv, b.conv) ||
        timestampDescending(a.mostRecentMsg, b.mostRecentMsg),
    );
  }

  const itemIds = items.map((a) => a.convId);

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto overscroll-contain [scrollbar-gutter:stable] w-full h-full"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: indicatorHeight,
          transition: pullY === 0 ? "height 0.2s ease" : "none",
        }}
      >
        {showSpinner && <Spinner size={20} />}
      </div>

      {itemIds.length ? (
        <div className="flex flex-col gap-[4px] pt-[10px] px-[10px]">
          {itemIds.map((key) => (
            <ChatListItem key={key} itemId={key} />
          ))}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center flex-col text-foreground text-[15px] mt-[-24px]">
          {t("Nada por aquí")}
          {(searchPattern || filterName !== Filters.ALL) && (
            <button
              className="text-[13px] text-primary"
              onClick={() => {
                setSearchPattern("");
                setFilterName(Filters.ALL);
              }}
            >
              {t("remover filtros...")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatList;
