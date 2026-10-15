import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";

import { cardPicture } from "./cardChips";
import type { DeckCard } from "./types";
import { DECK_POOL_SIZE_QUERY_KEY, fetchDeckPoolSize } from "./useDeckPoolSize";

/** How many upcoming cards' pictures are fetched ahead of time. The stack draws three, so this is
 * the three on screen and the next three: a fast swiper never waits on a blank picture. */
const PREFETCH_PICTURES = 6;

/**
 * Two things the Deck can know before it needs them.
 *
 * 1. The next six pictures go into expo-image's memory and disk cache (CardFace draws with
 *    "memory-disk"), so a card that rises to the top already has its picture instead of fading it
 *    in a moment late. Keyed by the joined URLs, so a swipe that does not change the six (a refill
 *    appending further down) sends nothing.
 *
 * 2. When the deck has settled with ONE card left, the pool size is fetched into the same cache
 *    entry useEmptyDeckReason reads, so if that card turns out to be the last, the empty deck
 *    already knows why it is empty and goes straight to its answer instead of holding a skeleton
 *    while it asks. Once per drain: the ref resets only when the deck holds more than one card
 *    again, which keeps this well inside get_deck_pool_size's 20-a-minute rate limit however many
 *    times the screen re-renders at one card. Same key and staleTime (30s) as useDeckPoolSize.
 *
 * `settled` is the Deck's "loaded without an error"; nothing is fetched before that.
 */
export function useDeckPrefetch(cards: DeckCard[], settled: boolean) {
  const queryClient = useQueryClient();
  const urls = cards
    .slice(0, PREFETCH_PICTURES)
    .map(cardPicture)
    .filter((url): url is string => !!url);
  const urlsKey = urls.join("\n");

  useEffect(() => {
    if (!settled || !urlsKey) return;
    void Image.prefetch(urlsKey.split("\n"), "memory-disk").catch(() => {});
  }, [settled, urlsKey]);

  const poolAskedRef = useRef(false);
  const count = cards.length;
  useEffect(() => {
    if (count > 1) {
      poolAskedRef.current = false;
      return;
    }
    if (!settled || count !== 1 || poolAskedRef.current) return;
    poolAskedRef.current = true;
    void queryClient
      .prefetchQuery({ queryKey: DECK_POOL_SIZE_QUERY_KEY, queryFn: fetchDeckPoolSize, staleTime: 30_000 })
      .catch(() => {});
  }, [settled, count, queryClient]);
}
