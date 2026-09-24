import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SwipeCard, type SwipeCardContext, type SwipeCardTrigger } from "./SwipeCard";
import type { DeckCard, SwipeDirection } from "./types";

const STACK_DEPTH = 3;

export interface SwipeDeckHandle {
  like: () => void;
  pass: () => void;
}

interface SwipeDeckProps {
  cards: DeckCard[];
  onSwiped: (card: DeckCard, direction: SwipeDirection) => void;
  /** "party" for the party deck, whose pair counts are not about you. Defaults to "deck". */
  context?: SwipeCardContext;
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { cards, onSwiped, context = "deck" },
  ref,
) {
  const [trigger, setTrigger] = useState<SwipeCardTrigger | null>(null);
  const visibleCards = cards.slice(0, STACK_DEPTH);

  useImperativeHandle(ref, () => ({
    like: () => setTrigger({ direction: "like", nonce: Date.now() }),
    pass: () => setTrigger({ direction: "pass", nonce: Date.now() }),
  }));

  function handleTopSwiped(direction: SwipeDirection) {
    const top = cards[0];
    setTrigger(null);
    if (top) onSwiped(top, direction);
  }

  return (
    <View style={styles.container}>
      {visibleCards.map((card, indexFromTop) => {
        const scale = 1 - indexFromTop * 0.04;
        const translateY = indexFromTop * 12;
        return (
          <View
            key={card.profile_id}
            style={[
              StyleSheet.absoluteFill,
              { zIndex: visibleCards.length - indexFromTop, transform: [{ scale }, { translateY }] },
            ]}
            pointerEvents={indexFromTop === 0 ? "auto" : "none"}
            // The two cards peeking under the top one are scenery: VoiceOver and TalkBack skip
            // them, or they read two more names and two dimmed "See full profile" buttons.
            accessibilityElementsHidden={indexFromTop !== 0}
            importantForAccessibility={indexFromTop === 0 ? "auto" : "no-hide-descendants"}
          >
            <SwipeCard
              card={card}
              isTop={indexFromTop === 0}
              onSwiped={handleTopSwiped}
              externalTrigger={indexFromTop === 0 ? trigger : null}
              context={context}
            />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
