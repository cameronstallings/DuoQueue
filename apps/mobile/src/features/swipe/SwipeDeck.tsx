import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SwipeCard, type SwipeCardTrigger } from "./SwipeCard";
import type { DeckCard, SwipeDirection } from "./types";

const STACK_DEPTH = 3;

export interface SwipeDeckHandle {
  like: () => void;
  pass: () => void;
}

interface SwipeDeckProps {
  cards: DeckCard[];
  onSwiped: (card: DeckCard, direction: SwipeDirection) => void;
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { cards, onSwiped },
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
          >
            <SwipeCard
              card={card}
              isTop={indexFromTop === 0}
              onSwiped={handleTopSwiped}
              externalTrigger={indexFromTop === 0 ? trigger : null}
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
