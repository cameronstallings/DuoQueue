import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";

import { createCustomCatalogEntry, useCatalogSearch, type CatalogItem } from "./useCatalogSearch";

interface CatalogPickerProps {
  table: "games" | "shows";
  placeholder: string;
  profileId: string;
  selectedIds: string[];
  onSelect: (item: CatalogItem) => void;
}

export function CatalogPicker({ table, placeholder, profileId, selectedIds, onSelect }: CatalogPickerProps) {
  const { colors, radius, spacing } = useTheme();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: results, isLoading } = useCatalogSearch(table, query);

  const trimmed = query.trim();
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

      {trimmed.length <= 1 && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          Type at least 2 characters to search — or add your own if it&apos;s not listed.
        </Text>
      )}

      {isLoading && <ActivityIndicator color={colors.brand} />}

      {trimmed.length > 1 && !isLoading && (results ?? []).length === 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>No matches — add it as a custom entry below.</Text>
      )}

      {(results ?? [])
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
            <Text style={{ color: colors.text }}>{item.name}</Text>
          </Pressable>
        ))}

      {trimmed.length > 1 && !hasExactMatch && !isLoading && (
        <Pressable
          onPress={() => void handleCreateCustom()}
          disabled={creating}
          style={{
            padding: spacing.sm,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.brand,
          }}
        >
          <Text style={{ color: colors.brand, fontWeight: "600" }}>
            {creating ? "Adding…" : `+ Add "${trimmed}"`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
