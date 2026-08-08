import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";

import {
  CATALOG_MIN_QUERY,
  createCustomCatalogEntry,
  useCatalogSearch,
  type CatalogItem,
} from "./useCatalogSearch";

interface CatalogPickerProps {
  table: "games" | "shows";
  placeholder: string;
  profileId: string;
  selectedIds: string[];
  onSelect: (item: CatalogItem) => void;
}

export function CatalogPicker({ table, placeholder, profileId, selectedIds, onSelect }: CatalogPickerProps) {
  const { colors, radius, spacing, type } = useTheme();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: results, isLoading } = useCatalogSearch(table, query);

  const trimmed = query.trim();
  // Nothing renders until there's a real query — the catalog is too big to browse, and
  // an unprompted A-to-Z list under a "type to search" caption reads as the whole set.
  const searching = trimmed.length >= CATALOG_MIN_QUERY;
  const hasExactMatch = (results ?? []).some((item) => item.name.toLowerCase() === trimmed.toLowerCase());

  async function handleCreateCustom() {
    if (!trimmed) return;
    setCreating(true);
    try {
      const item = await createCustomCatalogEntry(table, trimmed, profileId);
      onSelect(item);
      setQuery("");
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
          Type at least 2 characters to search, or add your own if it&apos;s not listed.
        </Text>
      )}

      {searching && isLoading && (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="80%" height={16} borderRadius={radius.sm} />
          <Skeleton width="60%" height={16} borderRadius={radius.sm} />
        </View>
      )}

      {searching && !isLoading && (results ?? []).length === 0 && (
        <Text style={[type.caption, { color: colors.textMuted }]}>No matches. Add it as a custom entry below.</Text>
      )}

      {searching && (results ?? [])
        .filter((item) => !selectedIds.includes(item.id))
        .map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              onSelect(item);
              setQuery("");
            }}
            style={{
              padding: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={[type.body, { color: colors.text }]}>{item.name}</Text>
          </Pressable>
        ))}

      {searching && !hasExactMatch && !isLoading && (
        <Pressable
          onPress={() => void handleCreateCustom()}
          disabled={creating}
          style={{
            padding: spacing.sm,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.volt,
          }}
        >
          <Text style={[type.caption, { color: colors.voltDim }]}>
            {creating ? "Adding…" : `+ Add "${trimmed}"`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
