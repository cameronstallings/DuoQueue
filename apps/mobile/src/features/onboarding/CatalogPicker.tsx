import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { addCustomLabel, GAMES_COPY } from "@/features/auth/frontDoorCopy";
import { hapticSelection } from "@/lib/haptics";
import { layoutTransition, quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { normalizeCustomName, pendingCustomGameId, showAddCustom } from "./catalogSearch";
import { type CatalogItem, createCustomCatalogEntry } from "./customGames";
import { CATALOG_MIN_QUERY, useCatalogSearch } from "./useCatalogSearch";

interface CatalogPickerProps {
  table: "games" | "shows";
  placeholder: string;
  /**
   * The signed-in player, who can own a custom entry right away. Without it (the 1.0.2 wizard,
   * signed out), "Not listed? Add" hands back a PENDING game (catalogSearch.ts) that the onboarding
   * store creates at Save; a show cannot be added without one, so the button does not appear.
   */
  profileId?: string;
  selectedIds: string[];
  onSelect: (item: CatalogItem) => void;
}

/**
 * Search the games or shows catalog and pick from it, or add a missing entry.
 *
 * Calm while typing (1.0.2): the last results stay up while the next search runs (the hook keeps
 * them), the skeleton shows only before there is anything at all, and "No matches yet." with the
 * add button appears only once a search has SETTLED on nothing (`showAddCustom`), so neither
 * flashes on every keystroke nor invites a duplicate of a game the catalog already has.
 */
export function CatalogPicker({ table, placeholder, profileId, selectedIds, onSelect }: CatalogPickerProps) {
  const { colors, radius, spacing, type } = useTheme();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: results, isFetching, isError, debounced } = useCatalogSearch(table, query);

  const trimmed = query.trim();
  // Nothing renders until there's a real query: the catalog is too big to browse, and an
  // unprompted A-to-Z list under a "type to search" caption reads as the whole set.
  const searching = trimmed.length >= CATALOG_MIN_QUERY;
  const rows = results ?? [];
  const settledEmpty = showAddCustom({
    trimmed,
    debounced,
    isFetching,
    resultCount: rows.length,
    minQuery: CATALOG_MIN_QUERY,
  });
  const canAdd = settledEmpty && (profileId !== undefined || table === "games");
  const showSkeleton = searching && results === undefined && !isError;

  function pick(item: CatalogItem) {
    hapticSelection();
    onSelect(item);
    setQuery("");
  }

  async function handleAdd() {
    if (!trimmed) return;
    if (profileId === undefined) {
      // No account yet: held in the draft under a pending id and created at Save.
      if (table !== "games") return;
      pick({ id: pendingCustomGameId(trimmed), name: normalizeCustomName(trimmed) });
      return;
    }
    setCreating(true);
    try {
      pick(await createCustomCatalogEntry(table, trimmed, profileId));
    } catch (err) {
      console.warn(`Failed to add custom ${table} entry:`, err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField label={placeholder} value={query} onChangeText={setQuery} autoCapitalize="words" />

      {!searching && (
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {table === "games"
            ? GAMES_COPY.searchHint
            : "Type at least 2 characters to search, or add your own if it's not listed."}
        </Text>
      )}

      {showSkeleton && (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="80%" height={16} borderRadius={radius.sm} />
          <Skeleton width="60%" height={16} borderRadius={radius.sm} />
        </View>
      )}

      {searching && settledEmpty && (
        <Animated.Text entering={quickEntering()} style={[type.caption, { color: colors.textMuted }]}>
          {GAMES_COPY.noMatches}
        </Animated.Text>
      )}

      {searching &&
        rows
          .filter((item) => !selectedIds.includes(item.id))
          .map((item) => (
            <Animated.View key={item.id} entering={quickEntering()} layout={layoutTransition()}>
              <Pressable
                accessibilityRole="button"
                onPress={() => pick(item)}
                style={({ pressed }) => ({
                  padding: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={[type.body, { color: colors.text }]}>{item.name}</Text>
              </Pressable>
            </Animated.View>
          ))}

      {searching && canAdd && (
        <Animated.View entering={quickEntering()} exiting={quickExiting()} layout={layoutTransition()}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleAdd()}
            disabled={creating}
            style={({ pressed }) => ({
              padding: spacing.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.volt,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type.caption, { color: colors.voltDim }]}>
              {creating ? "Adding..." : addCustomLabel(trimmed)}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
